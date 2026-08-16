class TmdbApi {
    static async searchPerson(query) {
        if (!query) return null;
        try {
            const response = await fetch(`${this.BASE_URL}/search/person?api_key=${this.API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`);
            const data = await response.json();
            return data.results && data.results.length > 0 ? data.results[0] : null;
        } catch (e) {
            console.error("TMDB Search Person Error:", e);
            return null;
        }
    }

    static async getPersonCredits(personId) {
        try {
            const response = await fetch(`${this.BASE_URL}/person/${personId}/combined_credits?api_key=${this.API_KEY}&language=pt-BR`);
            const data = await response.json();
            return data.cast || []; // array of movies and tv shows
        } catch (e) {
            console.error("TMDB Get Person Credits Error:", e);
            return [];
        }
    }

    /**
     * Search for a movie by name
     */
    static async searchMovie(query) {
        if (!query) return null;
        try {
            // Clean query to improve matching (remove 1080p, 4k, PT-BR, etc.)
            const cleanQuery = this._cleanTitle(query);
            const response = await fetch(`${this.BASE_URL}/search/movie?api_key=${this.API_KEY}&query=${encodeURIComponent(cleanQuery)}&language=pt-BR`);
            const data = await response.json();
            return data.results && data.results.length > 0 ? data.results[0] : null;
        } catch (e) {
            console.error("TMDB Search Movie Error:", e);
            return null;
        }
    }

    /**
     * Search for a TV show by name
     */
    static async searchTvShow(query) {
        if (!query) return null;
        try {
            const cleanQuery = this._cleanTitle(query);
            const response = await fetch(`${this.BASE_URL}/search/tv?api_key=${this.API_KEY}&query=${encodeURIComponent(cleanQuery)}&language=pt-BR`);
            const data = await response.json();
            return data.results && data.results.length > 0 ? data.results[0] : null;
        } catch (e) {
            console.error("TMDB Search TV Error:", e);
            return null;
        }
    }

    /**
     * Get detailed information including cast
     */
    static async getDetails(id, type = 'movie') {
        try {
            const endpoint = type === 'movie' ? 'movie' : 'tv';
            const response = await fetch(`${this.BASE_URL}/${endpoint}/${id}?api_key=${this.API_KEY}&language=pt-BR&append_to_response=credits`);
            const data = await response.json();
            
            return {
                overview: data.overview || "Nenhuma sinopse disponível.",
                backdropPath: data.backdrop_path ? `${this.IMAGE_BASE_URL}${data.backdrop_path}` : null,
                posterPath: data.poster_path ? `${this.POSTER_BASE_URL}${data.poster_path}` : null,
                rating: data.vote_average ? data.vote_average.toFixed(1) : "N/A",
                releaseDate: data.release_date || data.first_air_date || "",
                genres: data.genres ? data.genres.map(g => g.name).join(", ") : "",
                cast: data.credits && data.credits.cast ? data.credits.cast.slice(0, 10).map(c => ({
                    id: c.id,
                    name: c.name,
                    character: c.character,
                    profilePath: c.profile_path ? `${this.POSTER_BASE_URL}${c.profile_path}` : null
                })) : []
            };
        } catch (e) {
            console.error("TMDB Get Details Error:", e);
            return null;
        }
    }

    /**
     * Helper to remove common IPTV tags from names
     */
    static _cleanTitle(title) {
        let clean = title.replace(/(1080p|720p|4k|FHD|HD|SD|PT-BR|DUBLADO|LEGENDADO|VOD|\[.*?\]|\(.*?\))/gi, '');
        // Remove trailing years if strictly required or extra dashes
        clean = clean.split('-')[0];
        return clean.trim();
    }
}

TmdbApi.API_KEY = "39a368e46831b064e387198130b9f541";
TmdbApi.BASE_URL = "https://api.themoviedb.org/3";
TmdbApi.IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w780";
TmdbApi.POSTER_BASE_URL = "https://image.tmdb.org/t/p/w300";
