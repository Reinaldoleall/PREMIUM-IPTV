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
        // Clear related content
        await this.clearContent();
    },
    
    async saveChannels(channels) {
        await DB_CHANNELS.setItem("all", channels);
    },
    async getChannels() {
        return (await DB_CHANNELS.getItem("all")) || [];
    },
    
    async saveMovies(movies) {
        await DB_MOVIES.setItem("all", movies);
    },
    async getMovies() {
        return (await DB_MOVIES.getItem("all")) || [];
    },
    
    async saveSeries(series) {
        await DB_SERIES.setItem("all", series);
    },
    async getSeries() {
        return (await DB_SERIES.getItem("all")) || [];
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
        return index === -1; // returns true if added
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
        history.unshift(item); // Add to beginning
        if (history.length > 100) history.pop(); // Keep only last 100
        await getProfileDB('history').setItem("all", history);
    },
    
    async clearContent() {
        await DB_CHANNELS.clear();
        await DB_MOVIES.clear();
        await DB_SERIES.clear();
    }
};
