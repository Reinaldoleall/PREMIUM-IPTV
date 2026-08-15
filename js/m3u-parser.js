class M3UParser {
    static workerScript = `
        self.onmessage = function(e) {
            const m3uText = e.data;
            const lines = m3uText.split(/\\r?\\n/);
            const channels = [];
            const movies = [];
            const series = [];

            let currentName = "Unknown";
            let currentLogo = "";
            let currentGroup = "";
            let currentEpgId = "";

            // Group Series Logic
            const groupedSeriesMap = {};
            const rawSeries = [];

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (!line) continue;

                if (line.startsWith("#EXTINF:")) {
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    if (logoMatch) currentLogo = logoMatch[1];

                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    if (groupMatch) currentGroup = groupMatch[1];

                    const epgIdMatch = line.match(/tvg-id="([^"]*)"/);
                    if (epgIdMatch) currentEpgId = epgIdMatch[1];

                    if (!currentEpgId) {
                        const epgNameMatch = line.match(/tvg-name="([^"]*)"/);
                        if (epgNameMatch) currentEpgId = epgNameMatch[1];
                    }

                    const commaIndex = line.lastIndexOf(",");
                    if (commaIndex !== -1) {
                        currentName = line.substring(commaIndex + 1).trim();
                    }
                } else if (line.startsWith("#EXTGRP:")) {
                    currentGroup = line.substring(8).trim();
                } else if (!line.startsWith("#")) {
                    const item = {
                        id: btoa(encodeURIComponent(line)),
                        name: currentName,
                        url: line,
                        logo: currentLogo,
                        group: currentGroup,
                        epgId: currentEpgId
                    };

                    const lowerGroup = currentGroup.toLowerCase();
                    const lowerUrl = line.toLowerCase();
                    
                    if (lowerGroup.includes("filme") || lowerGroup.includes("movie") || lowerGroup.includes("vod") || lowerUrl.endsWith(".mkv") || lowerUrl.endsWith(".mp4") || lowerUrl.includes("/movie/")) {
                        movies.push(item);
                    } else if (lowerGroup.includes("série") || lowerGroup.includes("serie") || lowerGroup.includes("series") || lowerUrl.includes("/series/")) {
                        rawSeries.push(item);
                    } else {
                        channels.push(item);
                    }

                    currentName = "Unknown";
                    currentLogo = "";
                    currentGroup = "";
                    currentEpgId = "";
                }
            }

            rawSeries.forEach(item => {
                const match = item.name.match(/(.*?)(?:\\s+[-:]\\s+)?S(\\d+)\\s*E(\\d+)/i) || 
                              item.name.match(/(.*?)(?:\\s+[-:]\\s+)?Season\\s*(\\d+)\\s*Episode\\s*(\\d+)/i);
                
                let seriesName = item.name;
                let season = 1;
                let episode = 1;
                let epName = item.name;

                if (match) {
                    seriesName = match[1].trim();
                    season = parseInt(match[2], 10);
                    episode = parseInt(match[3], 10);
                } else {
                    // Try just E01
                    const epMatch = item.name.match(/(.*?)\\s+E(\\d+)/i);
                    if (epMatch) {
                        seriesName = epMatch[1].trim();
                        episode = parseInt(epMatch[2], 10);
                    }
                }

                if (!groupedSeriesMap[seriesName]) {
                    groupedSeriesMap[seriesName] = {
                        id: btoa(encodeURIComponent(seriesName)),
                        name: seriesName,
                        logo: item.logo,
                        group: item.group,
                        isSeries: true,
                        seasons: {}
                    };
                }
                
                if (!groupedSeriesMap[seriesName].seasons[season]) {
                    groupedSeriesMap[seriesName].seasons[season] = [];
                }
                
                groupedSeriesMap[seriesName].seasons[season].push({
                    episode: episode,
                    name: epName,
                    url: item.url
                });
            });

            // Convert to array and sort
            for (let sName in groupedSeriesMap) {
                const s = groupedSeriesMap[sName];
                for (let seq in s.seasons) {
                    s.seasons[seq].sort((a,b) => a.episode - b.episode);
                }
                series.push(s);
            }

            self.postMessage({ channels, movies, series });
        };
    `;

    static async parse(m3uText) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([this.workerScript], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));

            worker.onmessage = (e) => {
                resolve(e.data);
                worker.terminate();
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            worker.postMessage(m3uText);
        });
    }

    static async fetchAndParse(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            return await this.parse(text);
        } catch (error) {
            console.error("Error fetching or parsing M3U:", error);
            throw error;
        }
    }
}
