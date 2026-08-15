class M3UParser {
    static async parse(m3uText) {
        const lines = m3uText.split(/\r?\n/);
        const channels = [];
        const movies = [];
        const series = [];

        let currentName = "Unknown";
        let currentLogo = "";
        let currentGroup = "";
        let currentEpgId = "";

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith("#EXTINF:")) {
                // Parse logo
                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                if (logoMatch) currentLogo = logoMatch[1];

                // Parse group
                const groupMatch = line.match(/group-title="([^"]*)"/);
                if (groupMatch) currentGroup = groupMatch[1];

                // Parse epg id
                const epgIdMatch = line.match(/tvg-id="([^"]*)"/);
                if (epgIdMatch) currentEpgId = epgIdMatch[1];

                if (!currentEpgId) {
                    const epgNameMatch = line.match(/tvg-name="([^"]*)"/);
                    if (epgNameMatch) currentEpgId = epgNameMatch[1];
                }

                // Parse name
                const commaIndex = line.lastIndexOf(",");
                if (commaIndex !== -1) {
                    currentName = line.substring(commaIndex + 1).trim();
                }
            } else if (line.startsWith("#EXTGRP:")) {
                currentGroup = line.substring(8).trim();
            } else if (!line.startsWith("#")) {
                const item = {
                    id: btoa(encodeURIComponent(line)), // Basic unique ID based on URL
                    name: currentName,
                    url: line,
                    logo: currentLogo,
                    group: currentGroup,
                    epgId: currentEpgId
                };

                // Simple categorization based on URL or Group (very common in IPTV)
                const lowerGroup = currentGroup.toLowerCase();
                const lowerUrl = line.toLowerCase();
                
                if (lowerGroup.includes("filme") || lowerGroup.includes("movie") || lowerGroup.includes("vod") || lowerUrl.endsWith(".mkv") || lowerUrl.endsWith(".mp4") || lowerUrl.includes("/movie/")) {
                    movies.push(item);
                } else if (lowerGroup.includes("série") || lowerGroup.includes("serie") || lowerGroup.includes("series") || lowerUrl.includes("/series/")) {
                    series.push(item);
                } else {
                    channels.push(item);
                }

                // Reset
                currentName = "Unknown";
                currentLogo = "";
                currentGroup = "";
                currentEpgId = "";
            }
        }

        return { channels, movies, series };
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
