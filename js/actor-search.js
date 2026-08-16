document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-actors');
    const actorResults = document.getElementById('actor-results');
    const actorMoviesTitle = document.getElementById('actor-movies-title');
    
    let searchTimeout = null;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 3) {
            actorResults.innerHTML = '';
            actorMoviesTitle.style.display = 'none';
            document.getElementById('grid-actor-movies').innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(() => {
            performActorSearch(query);
        }, 800); // 800ms debounce
    });

    async function performActorSearch(query) {
        actorResults.innerHTML = '<p style="color:var(--text-secondary)">Buscando no TMDB...</p>';
        actorMoviesTitle.style.display = 'none';
        document.getElementById('grid-actor-movies').innerHTML = '';

        const person = await TmdbApi.searchPerson(query);
        
        if (!person) {
            actorResults.innerHTML = '<p style="color:var(--primary-red)">Ator não encontrado.</p>';
            return;
        }

        // Display Person info
        actorResults.innerHTML = `
            <div style="display: flex; gap: 24px; align-items: center; background: rgba(255,255,255,0.05); padding: 24px; border-radius: 12px;">
                <img src="${person.profile_path ? TmdbApi.POSTER_BASE_URL + person.profile_path : 'https://via.placeholder.com/150x225?text=No+Photo'}" 
                     style="width: 150px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <div>
                    <h3 style="font-size: 32px; color: var(--accent-gold); margin-bottom: 8px;">${person.name}</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Conhecido por: ${person.known_for_department}</p>
                    <p>Procurando títulos deste ator na sua lista M3U...</p>
                </div>
            </div>
        `;

        // Get credits
        const credits = await TmdbApi.getPersonCredits(person.id);
        const creditTitles = credits.map(c => (c.title || c.name || "").toLowerCase());

        // Cross-reference with Local DB
        const matchedItems = await DB.searchByTmdbTitles(creditTitles);

        actorMoviesTitle.style.display = 'block';
        if (matchedItems.length > 0) {
            UIManager.renderGrid('grid-actor-movies', matchedItems, (item) => {
                UIManager.showDetails(item, item.type || 'movie', (i) => Player.play(i));
            });
        } else {
            document.getElementById('grid-actor-movies').innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-outlined">sentiment_dissatisfied</span>
                    <p>O ator foi encontrado, mas você não tem nenhum filme/série com ele na sua lista M3U atual.</p>
                </div>
            `;
        }
    }
});
