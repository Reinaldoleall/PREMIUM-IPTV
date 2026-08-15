class EPGParser {
    static async fetchAndParse(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

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

            const xmlText = await response.text();
            if (!xmlText || xmlText.trim() === '') {
                const errorObj = new Error("Resposta EPG vazia do servidor");
                errorObj.code = 'EMPTY_RESPONSE';
                throw errorObj;
            }
            
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
            if (error.name === 'AbortError') {
                const errorObj = new Error("Tempo limite do EPG excedido (30s)");
                errorObj.code = 'TIMEOUT';
                throw errorObj;
            }
            if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
                const errorObj = new Error("Falha na Rede ou Bloqueio de CORS no EPG");
                errorObj.code = 'NETWORK_CORS_ERROR';
                throw errorObj;
            }
            console.error("EPG Parse Error:", error);
            throw error;
        }
    }

    static async getStoredEpgUrl() {
        return await localforage.getItem('IPTV_EPG_URL');
    }

    static async setStoredEpgUrl(url) {
        await localforage.setItem('IPTV_EPG_URL', url);
    }
}
