const workerScript = `
        self.onmessage = function(e) {
            const m3uText = e.data;
            const lines = m3uText.split(/\\r?\\n/);
            let channels = [];
            let movies = [];
            let rawSeries = [];

            let currentName = "Unknown";
            let currentLogo = "";
            let currentGroup = "";
            let currentEpgId = "";

            const episodePattern = /(.+?)\\s*[\\-\\|]?\\s*S(\\d{1,2})\\s*E(\\d{1,2})/i;
            const yearPattern = /\\b(19\\d{2}|20\\d{2})\\b/;

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
                    const rawName = currentName;
                    const group = currentGroup;
                    const lowerGroup = group.toLowerCase();
                    const url = line;
                    const lowerUrl = url.toLowerCase();

                    let isSeries = false;
                    let isMovie = false;

                    const epMatch = rawName.match(episodePattern);
                    const hasEpisodePattern = !!epMatch;

                    if (hasEpisodePattern || lowerUrl.includes("/series/")) {
                        isSeries = true;
                    } else if (lowerUrl.includes("/movie/") || lowerUrl.includes(".mp4") || lowerUrl.includes(".mkv") || lowerUrl.includes(".avi") || lowerUrl.includes(".rmvb")) {
                        isMovie = true;
                    } else if (lowerGroup.includes("canais") || lowerGroup.includes("24h") || lowerGroup.includes("tv ") || lowerGroup === "tv" || lowerGroup.includes("ao vivo") || lowerGroup.includes("live tv") || lowerGroup.includes("esportes") || lowerGroup.includes("notícias") || lowerGroup.includes("abertos") || lowerGroup.includes("documentários")) {
                        // Live TV
                    } else if (lowerGroup.includes("serie") || lowerGroup.includes("série") || lowerGroup.includes("anime") || lowerGroup.includes("dorama") || lowerGroup.includes("novela") || lowerGroup.includes("temporada")) {
                        isSeries = true;
                    } else if (lowerGroup.includes("filme") || lowerGroup.includes("movie") || lowerGroup.includes("vod") || lowerGroup.includes("cinema") || lowerGroup.includes("lancamento") || lowerGroup.includes("lançamento") || lowerGroup.includes("4k") || lowerGroup.includes("legendado") || lowerGroup.includes("dublado") || lowerGroup.includes("oscar")) {
                        isMovie = true;
                    }

                    if (isSeries) {
                        let seriesName = rawName;
                        let seasonNum = "1";
                        let episodeNum = "1";

                        if (hasEpisodePattern) {
                            seriesName = epMatch[1].trim();
                            seasonNum = parseInt(epMatch[2], 10).toString();
                            episodeNum = parseInt(epMatch[3], 10).toString();
                            if (!seriesName) seriesName = rawName;
                        } else {
                            if (group && !lowerGroup.includes("séries") && !lowerGroup.includes("series") && !lowerGroup.includes("serie")) {
                                seriesName = group;
                            }
                        }

                        const lowerSeriesName = seriesName.toLowerCase();
                        if (lowerSeriesName.startsWith("séries - ") || lowerSeriesName.startsWith("series - ")) {
                            seriesName = seriesName.substring(9).trim();
                        } else if (lowerSeriesName.startsWith("série - ")) {
                            seriesName = seriesName.substring(8).trim();
                        }

                        rawSeries.push({
                            name: rawName,
                            seriesName: seriesName,
                            season: seasonNum,
                            episode: episodeNum,
                            url: url,
                            logo: currentLogo,
                            group: group || 'Sem Categoria',
                            epgId: currentEpgId
                        });

                    } else if (isMovie) {
                        let extractedYear = 0;
                        const ymMatch = rawName.match(yearPattern);
                        if (ymMatch) extractedYear = parseInt(ymMatch[1], 10);
                        if (extractedYear === 0 && group) {
                            const ymgMatch = group.match(yearPattern);
                            if (ymgMatch) extractedYear = parseInt(ymgMatch[1], 10);
                        }

                        movies.push({
                            name: rawName,
                            url: url,
                            logo: currentLogo,
                            group: group || 'Sem Categoria',
                            epgId: currentEpgId,
                            year: extractedYear
                        });

                        if (movies.length >= 300) {
                            self.postMessage({ type: 'chunk', category: 'movies', data: movies });
                            movies = [];
                        }
                    } else {
                        channels.push({
                            name: rawName,
                            url: url,
                            logo: currentLogo,
                            group: group || 'Sem Categoria',
                            epgId: currentEpgId,
                            tvgId: currentEpgId
                        });

                        if (channels.length >= 300) {
                            self.postMessage({ type: 'chunk', category: 'channels', data: channels });
                            channels = [];
                        }
                    }

                    currentName = "Unknown";
                    currentLogo = "";
                    currentGroup = "";
                    currentEpgId = "";
                }
            }

            // Send remaining chunks
            if (channels.length > 0) self.postMessage({ type: 'chunk', category: 'channels', data: channels });
            if (movies.length > 0) self.postMessage({ type: 'chunk', category: 'movies', data: movies });

            // Group Series Logic
            const groupedSeriesMap = {};
            rawSeries.forEach(item => {
                const sName = item.seriesName;
                const season = item.season;
                const episode = item.episode;

                if (!groupedSeriesMap[sName]) {
                    groupedSeriesMap[sName] = {
                        id: btoa(encodeURIComponent(sName).substring(0, 50)),
                        name: sName,
                        logo: item.logo,
                        group: item.group,
                        isSeries: true,
                        seasons: {}
                    };
                }
                
                if (!groupedSeriesMap[sName].seasons[season]) {
                    groupedSeriesMap[sName].seasons[season] = [];
                }
                
                groupedSeriesMap[sName].seasons[season].push({
                    episode: parseInt(episode, 10),
                    name: item.name,
                    url: item.url
                });
            });

            // Convert to array and chunk
            let series = [];
            for (let sName in groupedSeriesMap) {
                const s = groupedSeriesMap[sName];
                for (let seq in s.seasons) {
                    s.seasons[seq].sort((a,b) => a.episode - b.episode);
                }
                series.push(s);
                if (series.length >= 300) {
                    self.postMessage({ type: 'chunk', category: 'series', data: series });
                    series = [];
                }
            }
            if (series.length > 0) self.postMessage({ type: 'chunk', category: 'series', data: series });

            self.postMessage({ type: 'done' });
        };
    `;

class M3UParser {
    static async parse(m3uText) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));

            // Setup DB appending handlers
            worker.onmessage = async (e) => {
                const msg = e.data;
                if (msg.type === 'chunk') {
                    if (msg.category === 'channels') await DB.appendChannels(msg.data);
                    else if (msg.category === 'movies') await DB.appendMovies(msg.data);
                    else if (msg.category === 'series') await DB.appendSeries(msg.data);
                } else if (msg.type === 'done') {
                    worker.terminate();
                    resolve({ success: true });
                }
            };

            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };

            worker.postMessage(m3uText);
        });
    }

    static async fetchAndParse(url, clearFirst = true) {
        try {
            if (clearFirst) {
                await DB.clearContent();
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                let errorCode = `HTTP_${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMsg = errorData.error;
                        errorCode = errorData.code || errorCode;
                    }
                } catch(e) {}

                const errorObj = new Error(errorMsg);
                errorObj.status = response.status;
                errorObj.code = errorCode;
                throw errorObj;
            }

            const text = await response.text();
            if (!text || text.trim() === '') {
                const errorObj = new Error("Resposta vazia do servidor");
                errorObj.code = 'EMPTY_RESPONSE';
                throw errorObj;
            }

            return await this.parse(text);
        } catch (error) {
            if (error.name === 'AbortError') {
                const errorObj = new Error("Tempo limite da requisição excedido (30s)");
                errorObj.code = 'TIMEOUT';
                throw errorObj;
            }
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                const errorObj = new Error("Falha na Rede ou Bloqueio de CORS");
                errorObj.code = 'NETWORK_CORS_ERROR';
                throw errorObj;
            }
            console.error("Error fetching or parsing M3U:", error);
            throw error;
        }
    }
}
