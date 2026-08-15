class EPGParser {
    static async fetchAndParse(url) {
        try {
            const response = await fetch(url);
            const xmlText = await response.text();
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            
            const programmes = Array.from(xmlDoc.getElementsByTagName("programme"));
            const epgData = {};

            const now = new Date();
            const formatTime = (xmlTime) => {
                // XML time format: YYYYMMDDHHMMSS +/-ZZZZ
                if (!xmlTime) return null;
                const year = xmlTime.substring(0, 4);
                const month = xmlTime.substring(4, 6) - 1;
                const day = xmlTime.substring(6, 8);
                const hour = xmlTime.substring(8, 10);
                const minute = xmlTime.substring(10, 12);
                return new Date(year, month, day, hour, minute);
            };

            programmes.forEach(prog => {
                const channelId = prog.getAttribute("channel");
                const start = formatTime(prog.getAttribute("start"));
                const stop = formatTime(prog.getAttribute("stop"));
                
                // Only keep programs currently playing or playing soon
                if (stop > now && start.getTime() < now.getTime() + (24 * 60 * 60 * 1000)) {
                    if (!epgData[channelId]) epgData[channelId] = [];
                    
                    const titleNode = prog.getElementsByTagName("title")[0];
                    const descNode = prog.getElementsByTagName("desc")[0];
                    
                    epgData[channelId].push({
                        title: titleNode ? titleNode.textContent : "Programa sem título",
                        description: descNode ? descNode.textContent : "",
                        start: start,
                        stop: stop,
                        isNowPlaying: start <= now && stop > now
                    });
                }
            });

            // Sort programs by start time for each channel
            for (let channel in epgData) {
                epgData[channel].sort((a, b) => a.start - b.start);
            }

            return epgData;
        } catch (error) {
            console.error("EPG Parse Error:", error);
            throw new Error("Falha ao carregar o EPG. Verifique o CORS ou a validade da URL.");
        }
    }

    static async getStoredEpgUrl() {
        return await localforage.getItem('IPTV_EPG_URL');
    }

    static async setStoredEpgUrl(url) {
        await localforage.setItem('IPTV_EPG_URL', url);
    }
}
