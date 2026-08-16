class XtreamAPI {
    static async fetchAndParse(hostUrl, username, password) {
        const baseUrl = hostUrl.endsWith('/') ? hostUrl.slice(0, -1) : hostUrl;
        const apiPath = `${baseUrl}/player_api.php?username=${username}&password=${password}`;

        console.log(`[XtreamAPI] Iniciando fetch de ${apiPath}`);

        try {
            await DB.clearContent(); // Limpa banco antes de inserir novos
            
            // 1. Fetch Live Streams
            let liveData = await this._fetchJson(`${apiPath}&action=get_live_streams`);
            if (Array.isArray(liveData)) {
                let chunk = [];
                for(let i=0; i < liveData.length; i++) {
                    chunk.push({
                        name: liveData[i].name || 'Canal',
                        url: `${baseUrl}/live/${username}/${password}/${liveData[i].stream_id}.m3u8`,
                        logoUrl: liveData[i].stream_icon || '',
                        group: liveData[i].category_name || 'Sem Categoria',
                        tvgId: liveData[i].epg_channel_id || '',
                        streamId: `xtream_live_${liveData[i].stream_id}`
                    });
                    if (chunk.length >= 300) {
                        await DB.appendChannels(chunk);
                        chunk = [];
                        await new Promise(r => setTimeout(r, 5)); // Pausa para não estourar a RAM
                    }
                }
                if (chunk.length > 0) await DB.appendChannels(chunk);
            }
            liveData = null; // Free memory

            // 2. Fetch VOD Streams
            let vodData = await this._fetchJson(`${apiPath}&action=get_vod_streams`);
            if (Array.isArray(vodData)) {
                let chunk = [];
                for(let i=0; i < vodData.length; i++) {
                    const ext = vodData[i].container_extension || 'mp4';
                    chunk.push({
                        name: vodData[i].name || 'Filme',
                        url: `${baseUrl}/movie/${username}/${password}/${vodData[i].stream_id}.${ext}`,
                        logoUrl: vodData[i].stream_icon || '',
                        group: vodData[i].category_name || 'Sem Categoria',
                        streamId: `xtream_vod_${vodData[i].stream_id}`
                    });
                    if (chunk.length >= 300) {
                        await DB.appendMovies(chunk);
                        chunk = [];
                        await new Promise(r => setTimeout(r, 5));
                    }
                }
                if (chunk.length > 0) await DB.appendMovies(chunk);
            }
            vodData = null; // Free memory

            // 3. Fetch Series
            let seriesData = await this._fetchJson(`${apiPath}&action=get_series`);
            if (Array.isArray(seriesData)) {
                let chunk = [];
                for(let i=0; i < seriesData.length; i++) {
                    chunk.push({
                        name: seriesData[i].name || 'Série',
                        url: `xtream_series:${seriesData[i].series_id}:${baseUrl}:${username}:${password}`,
                        logoUrl: seriesData[i].cover || '',
                        group: seriesData[i].category_name || 'Sem Categoria',
                        streamId: `xtream_series_${seriesData[i].series_id}`
                    });
                    if (chunk.length >= 300) {
                        await DB.appendSeries(chunk);
                        chunk = [];
                        await new Promise(r => setTimeout(r, 5));
                    }
                }
                if (chunk.length > 0) await DB.appendSeries(chunk);
            }
            seriesData = null; // Free memory

        } catch (error) {
            console.error('[XtreamAPI] Falha ao baixar streams Xtream:', error);
            throw new Error('Falha ao conectar na API Xtream: ' + error.message);
        }

        return { success: true };
    }

    // Helper to fetch details for a specific series
    static async getSeriesInfo(seriesUrl) {
        // Format: xtream_series:{series_id}:{baseUrl}:{username}:{password}
        const parts = seriesUrl.split(':');
        if(parts.length < 5) throw new Error("Invalid series URL format");
        
        const seriesId = parts[1];
        // Support baseUrl with http(s)://
        const hostUrl = parts.slice(2, -2).join(':'); 
        const username = parts[parts.length - 2];
        const password = parts[parts.length - 1];

        const apiPath = `${hostUrl}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${seriesId}`;
        const data = await this._fetchJson(apiPath);
        
        const episodes = [];
        if (data.episodes) {
            for (let season in data.episodes) {
                const eps = data.episodes[season];
                if (Array.isArray(eps)) {
                    eps.forEach(ep => {
                        const ext = ep.container_extension || 'mp4';
                        episodes.push({
                            title: ep.title || `Episódio ${ep.episode_num}`,
                            season: season,
                            episodeNum: ep.episode_num,
                            url: `${hostUrl}/series/${username}/${password}/${ep.id}.${ext}`,
                            plot: ep.info ? ep.info.plot : '',
                            duration: ep.info ? ep.info.duration : ''
                        });
                    });
                }
            }
        }
        
        return {
            info: data.info || {},
            episodes: episodes
        };
    }

    // Advanced fetcher using Proxies to avoid CORS
    static async _fetchJson(url) {
        const strategies = [
            { name: 'Direct Fetch', url: url },
            { name: 'Vercel Proxy', url: `/api/proxy?url=${encodeURIComponent(url)}` },
            { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` },
            { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(url)}` }
        ];

        let lastError = null;
        for (let strategy of strategies) {
            try {
                const response = await fetch(strategy.url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data;
            } catch (e) {
                lastError = e;
            }
        }
        throw new Error(`All fetch strategies failed. Last error: ${lastError.message}`);
    }
}
