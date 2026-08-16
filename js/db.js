// Database Wrapper using localForage (IndexedDB)
const DB_CHANNELS = localforage.createInstance({ name: "IPTV_DB", storeName: "channels" });
const DB_MOVIES = localforage.createInstance({ name: "IPTV_DB", storeName: "movies" });
const DB_SERIES = localforage.createInstance({ name: "IPTV_DB", storeName: "series" });
const DB_SETTINGS = localforage.createInstance({ name: "IPTV_DB", storeName: "settings" });

let currentProfileId = 'default';
function getProfileDB(storeName) {
    return localforage.createInstance({ name: "IPTV_DB", storeName: `${storeName}_${currentProfileId}` });
}

const DB = {
    async getSources() {
        return (await DB_SETTINGS.getItem("sources")) || [];
    },
    async saveSource(source) {
        const sources = await this.getSources();
        source.id = Date.now().toString();
        sources.push(source);
        await DB_SETTINGS.setItem("sources", sources);
        return source;
    },
    async removeSource(id) {
        let sources = await this.getSources();
        sources = sources.filter(s => s.id !== id);
        await DB_SETTINGS.setItem("sources", sources);
        await this.clearContent();
    },
    
    async clearContent() {
        await DB_CHANNELS.clear();
        await DB_MOVIES.clear();
        await DB_SERIES.clear();
        await DB_CHANNELS.setItem("all_meta", 0);
        await DB_MOVIES.setItem("all_meta", 0);
        await DB_SERIES.setItem("all_meta", 0);
        await DB_CHANNELS.setItem("channels_groups", []);
        await DB_MOVIES.setItem("movies_groups", []);
        await DB_SERIES.setItem("series_groups", []);
    },

    async appendChannels(chunk) {
        await this._appendChunk(DB_CHANNELS, "all", chunk);
        await this._extractGroups(DB_CHANNELS, "channels", chunk);
    },
    async appendMovies(chunk) {
        await this._appendChunk(DB_MOVIES, "all", chunk);
        await this._extractGroups(DB_MOVIES, "movies", chunk);
    },
    async appendSeries(chunk) {
        await this._appendChunk(DB_SERIES, "all", chunk);
        await this._extractGroups(DB_SERIES, "series", chunk);
    },

    async _appendChunk(dbInstance, keyPrefix, chunk) {
        if (!chunk || chunk.length === 0) return;
        let meta = (await dbInstance.getItem(`${keyPrefix}_meta`)) || 0;
        await dbInstance.setItem(`${keyPrefix}_${meta}`, chunk);
        await dbInstance.setItem(`${keyPrefix}_meta`, meta + 1);
    },

    async _extractGroups(dbInstance, keyPrefix, chunk) {
        if (!chunk || chunk.length === 0) return;
        const groupsArr = (await dbInstance.getItem(`${keyPrefix}_groups`)) || [];
        const groupsSet = new Set(groupsArr);
        let added = false;
        
        for(let i=0; i<chunk.length; i++) {
            const g = chunk[i].group || 'Sem Categoria';
            if (!groupsSet.has(g)) {
                groupsSet.add(g);
                added = true;
            }
        }
        if (added) {
            await dbInstance.setItem(`${keyPrefix}_groups`, Array.from(groupsSet).sort());
        }
    },

    async searchByTmdbTitles(titlesArray) {
        const results = [];
        const cleanTitle = (t) => {
            return (t || '').replace(/\[.*?\]|\(.*?\)/g, '')
                           .replace(/(?:4k|fhd|hd|1080p|720p|h265|legendado|dublado|dual áudio|dual audio)/gi, '')
                           .trim().toLowerCase();
        };

        const searchInInstance = async (dbInstance, typeName) => {
            const totalChunks = (await dbInstance.getItem("all_meta")) || 0;
            for (let i = 0; i < totalChunks; i++) {
                const chunk = await dbInstance.getItem(`all_${i}`);
                if (!chunk) continue;
                for (const item of chunk) {
                    const cleanName = cleanTitle(item.name);
                    if (titlesArray.some(ct => ct.includes(cleanName) || cleanName.includes(ct))) {
                        item.type = typeName;
                        results.push(item);
                    }
                }
            }
        };

        await searchInInstance(DB_MOVIES, 'movie');
        await searchInInstance(DB_SERIES, 'series');
        return results;
    },

    async getGroups(type) {
        let dbInstance;
        if (type === 'channels') dbInstance = DB_CHANNELS;
        else if (type === 'movies') dbInstance = DB_MOVIES;
        else if (type === 'series') dbInstance = DB_SERIES;
        else return [];
        return (await dbInstance.getItem(`${type}_groups`)) || [];
    },

    async getPaginated(type, filterGroup, page, pageSize) {
        let dbInstance;
        if (type === 'channels') dbInstance = DB_CHANNELS;
        else if (type === 'movies') dbInstance = DB_MOVIES;
        else if (type === 'series') dbInstance = DB_SERIES;
        else return [];

        const keyPrefix = "all";
        const totalChunks = (await dbInstance.getItem(`${keyPrefix}_meta`)) || 0;
        
        let results = [];
        let itemsSkipped = 0;
        const targetSkip = page * pageSize;
        
        for (let i = 0; i < totalChunks; i++) {
            const chunk = await dbInstance.getItem(`${keyPrefix}_${i}`);
            if (!chunk) continue;
            
            for (let j = 0; j < chunk.length; j++) {
                const item = chunk[j];
                const itemGroup = item.group || 'Sem Categoria';
                
                if (filterGroup && itemGroup !== filterGroup) continue;
                
                if (itemsSkipped < targetSkip) {
                    itemsSkipped++;
                    continue;
                }
                
                results.push(item);
                if (results.length >= pageSize) {
                    return results;
                }
            }
        }
        return results;
    },

    async search(type, query) {
        if(!query) return [];
        query = query.toLowerCase();
        let dbInstance;
        if (type === 'channels') dbInstance = DB_CHANNELS;
        else if (type === 'movies') dbInstance = DB_MOVIES;
        else if (type === 'series') dbInstance = DB_SERIES;
        else return [];

        const keyPrefix = "all";
        const totalChunks = (await dbInstance.getItem(`${keyPrefix}_meta`)) || 0;
        let results = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const chunk = await dbInstance.getItem(`${keyPrefix}_${i}`);
            if (!chunk) continue;
            
            for (let j = 0; j < chunk.length; j++) {
                const item = chunk[j];
                if (item.name && item.name.toLowerCase().includes(query)) {
                    results.push(item);
                    if (results.length >= 50) return results; // max 50 for speed
                }
            }
        }
        return results;
    },
    
    setProfileContext(profileId) {
        currentProfileId = profileId;
    },

    async getFavorites() {
        return (await getProfileDB('favorites').getItem("all")) || [];
    },
    async toggleFavorite(item) {
        let favorites = await this.getFavorites();
        const index = favorites.findIndex(f => f.url === item.url);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(item);
        }
        await getProfileDB('favorites').setItem("all", favorites);
        return index === -1;
    },
    async isFavorite(url) {
        const favorites = await this.getFavorites();
        return favorites.some(f => f.url === url);
    },
    
    async getHistory() {
        return (await getProfileDB('history').getItem("all")) || [];
    },
    async addToHistory(item) {
        let history = await this.getHistory();
        history = history.filter(h => h.url !== item.url);
        item.watchedAt = Date.now();
        history.unshift(item);
        if (history.length > 100) history.pop();
        await getProfileDB('history').setItem("all", history);
    }
};
