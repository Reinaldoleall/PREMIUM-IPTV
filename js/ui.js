class UIManager {
    static renderGrid(containerId, items, onPlay) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons-outlined">inbox</span>
                    <p>Nenhum conteúdo encontrado.</p>
                </div>
            `;
            return;
        }

        const pageSize = 50;
        let currentPage = 0;

        const renderPage = () => {
            const start = currentPage * pageSize;
            const end = start + pageSize;
            const pageItems = items.slice(start, end);
            
            pageItems.forEach(item => {
                const card = this.createCard(item, onPlay);
                container.appendChild(card);
            });

            currentPage++;
            
            if (end < items.length) {
                const sentinel = document.createElement('div');
                sentinel.className = 'scroll-sentinel';
                sentinel.style.width = '100%';
                sentinel.style.height = '1px';
                container.appendChild(sentinel);
                observer.observe(sentinel);
            }
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    obs.unobserve(entry.target);
                    entry.target.remove();
                    renderPage();
                }
            });
        }, { rootMargin: '200px' });

        renderPage();
    }

    static async renderGridPaginated(containerId, fetchCallback, onPlay) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        const pageSize = 50;
        let currentPage = 0;
        let isFetching = false;
        let hasMore = true;

        const renderPage = async () => {
            if (isFetching || !hasMore) return;
            isFetching = true;
            
            const oldSentinel = container.querySelector('.scroll-sentinel');
            if(oldSentinel) oldSentinel.remove();

            const items = await fetchCallback(currentPage, pageSize);
            
            if (!items || items.length === 0) {
                if (currentPage === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="material-icons-outlined">inbox</span>
                            <p>Nenhum conteúdo encontrado.</p>
                        </div>
                    `;
                }
                hasMore = false;
                isFetching = false;
                return;
            }

            items.forEach(item => {
                const card = this.createCard(item, onPlay);
                container.appendChild(card);
            });

            currentPage++;
            
            if (items.length === pageSize) {
                const sentinel = document.createElement('div');
                sentinel.className = 'scroll-sentinel';
                sentinel.style.width = '100%';
                sentinel.style.height = '1px';
                container.appendChild(sentinel);
                observer.observe(sentinel);
            } else {
                hasMore = false;
            }
            isFetching = false;
        };

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !isFetching && hasMore) {
                    obs.unobserve(entry.target);
                    renderPage();
                }
            });
        }, { rootMargin: '400px' });

        await renderPage();
    }

    static renderCarousel(containerId, items, onPlay) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        if(!items || items.length === 0) return;

        items.slice(0, 15).forEach(item => {
            const card = this.createCard(item, onPlay);
            container.appendChild(card);
        });
    }

    static createCard(item, onPlay) {
        const card = document.createElement('div');
        card.className = 'card';
        card.tabIndex = 0; // Make focusable for remote control

        const imgContainer = document.createElement('div');
        imgContainer.className = 'card-img-container';
        
        const img = document.createElement('img');
        img.src = item.logo || 'assets/placeholder.png';
        img.onerror = () => { img.src = 'https://via.placeholder.com/200x300?text=No+Image'; };
        
        imgContainer.appendChild(img);

        const info = document.createElement('div');
        info.className = 'card-info';
        
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = item.name;

        info.appendChild(title);
        card.appendChild(imgContainer);
        card.appendChild(info);

        // Events
        card.addEventListener('click', () => onPlay(item));
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') onPlay(item);
        });

        return card;
    }

    static async renderFilters(containerId, type, onFilter) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        // Fetch unique groups directly from DB metadata
        const groups = await DB.getGroups(type);
        
        const createPill = (text, onClick, isActive = false) => {
            const pill = document.createElement('div');
            pill.className = 'filter-pill' + (isActive ? ' active' : '');
            pill.textContent = text;
            pill.tabIndex = 0; // TV D-Pad Focus
            
            const activate = () => {
                document.querySelectorAll(`#${containerId} .filter-pill`).forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                onClick();
            };
            
            pill.onclick = activate;
            pill.onkeypress = (e) => { if(e.key === 'Enter') activate(); };
            return pill;
        };

        // "Todos" filter
        container.appendChild(createPill('Todos', () => onFilter(null), true));

        // "Favoritos" filter
        container.appendChild(createPill('Favoritos', () => {
            onFilter('__FAVORITES__');
        }));

        groups.forEach(group => {
            container.appendChild(createPill(group, () => onFilter(group)));
        });
    }

    static renderHomeBanner(movie, onPlay) {
        if(!movie) return;
        document.getElementById('hero-title').textContent = movie.name;
        document.getElementById('hero-desc').textContent = movie.overview || "Explore este e muitos outros títulos no IPTV Premium.";
        
        if (movie.backdropPath) {
            document.getElementById('hero-banner').style.backgroundImage = `url('${movie.backdropPath}')`;
        } else if (movie.logo) {
            document.getElementById('hero-banner').style.backgroundImage = `url('${movie.logo}')`;
        }

        const banner = document.getElementById('hero-banner');
        banner.onclick = () => onPlay(movie);
        banner.style.cursor = 'pointer';
    }

    static async renderSources(containerId) {
        const container = document.getElementById(containerId);
        const sources = await DB.getSources();
        container.innerHTML = '';

        if (sources.length === 0) {
            container.innerHTML = '<p>Nenhuma fonte adicionada.</p>';
            return;
        }

        sources.forEach(source => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            el.style.padding = '12px';
            el.style.background = 'rgba(255,255,255,0.05)';
            el.style.marginBottom = '8px';
            el.style.borderRadius = '8px';

            const name = document.createElement('span');
            name.textContent = source.name;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-secondary';
            delBtn.textContent = 'Remover';
            delBtn.onclick = async () => {
                await DB.removeSource(source.id);
                this.renderSources(containerId);
                window.dispatchEvent(new Event('sourcesChanged'));
            };

            el.appendChild(name);
            el.appendChild(delBtn);
            container.appendChild(el);
        });
    }

    static showModal(id) {
        document.getElementById(id).classList.add('active');
    }

    static hideModal(id) {
        document.getElementById(id).classList.remove('active');
    }

    static async showDetails(item, type, onPlay) {
        const overlay = document.getElementById('detail-overlay');
        const title = document.getElementById('detail-title');
        const overview = document.getElementById('detail-overview');
        const rating = document.getElementById('detail-rating');
        const year = document.getElementById('detail-year');
        const genres = document.getElementById('detail-genres');
        const poster = document.getElementById('detail-poster');
        const backdrop = document.getElementById('detail-backdrop');
        const castContainer = document.getElementById('detail-cast');
        const playBtn = document.getElementById('btn-detail-play');
        const favBtn = document.getElementById('btn-detail-fav');
        const seasonsContainer = document.getElementById('detail-seasons-container');
        const seasonsTabs = document.getElementById('seasons-tabs');
        const episodesList = document.getElementById('episodes-list');
        
        // Reset state
        title.textContent = item.name;
        poster.src = item.logo || 'assets/placeholder.png';
        backdrop.style.backgroundImage = 'none';
        overview.textContent = "Carregando detalhes...";
        rating.innerHTML = `<span class="material-icons-outlined">star</span> N/A`;
        year.textContent = "";
        genres.textContent = item.group || "";
        castContainer.innerHTML = "";
        seasonsContainer.style.display = "none";
        seasonsTabs.innerHTML = "";
        episodesList.innerHTML = "";
        
        // Show overlay instantly
        overlay.classList.add('active');
        
        // Setup play action
        if (item.isSeries && item.seasons) {
            playBtn.innerHTML = `<span class="material-icons-outlined">play_arrow</span> S01E01`;
            const firstSeason = Object.keys(item.seasons)[0];
            const firstEp = item.seasons[firstSeason][0];
            playBtn.onclick = () => {
                overlay.classList.remove('active');
                onPlay(firstEp);
            };

            // Render Seasons
            seasonsContainer.style.display = "block";
            const seasonNumbers = Object.keys(item.seasons).sort((a,b) => parseInt(a) - parseInt(b));
            
            seasonNumbers.forEach((seasonKey, index) => {
                const btn = document.createElement('button');
                btn.className = 'filter-pill' + (index === 0 ? ' active' : '');
                btn.textContent = `Temporada ${seasonKey}`;
                btn.onclick = () => {
                    document.querySelectorAll('#seasons-tabs .filter-pill').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderEpisodes(item.seasons[seasonKey]);
                };
                seasonsTabs.appendChild(btn);
            });

            const renderEpisodes = (episodes) => {
                episodesList.innerHTML = "";
                episodes.forEach(ep => {
                    const epEl = document.createElement('div');
                    epEl.style.display = 'flex';
                    epEl.style.alignItems = 'center';
                    epEl.style.padding = '12px';
                    epEl.style.background = 'rgba(255,255,255,0.05)';
                    epEl.style.borderRadius = '8px';
                    epEl.style.cursor = 'pointer';
                    epEl.style.transition = 'background 0.2s';
                    epEl.onmouseover = () => epEl.style.background = 'rgba(255,255,255,0.1)';
                    epEl.onmouseout = () => epEl.style.background = 'rgba(255,255,255,0.05)';
                    
                    epEl.innerHTML = `
                        <div style="margin-right: 16px; font-weight: bold; color: var(--accent-gold);">E${ep.episode}</div>
                        <div style="flex: 1; font-size: 14px;">${ep.name}</div>
                        <span class="material-icons-outlined">play_circle</span>
                    `;
                    
                    epEl.onclick = () => {
                        overlay.classList.remove('active');
                        onPlay(ep);
                    };
                    episodesList.appendChild(epEl);
                });
            };
            
            // Render first season by default
            if (seasonNumbers.length > 0) {
                renderEpisodes(item.seasons[seasonNumbers[0]]);
            }
        } else {
            playBtn.innerHTML = `<span class="material-icons-outlined">play_arrow</span> Assistir`;
            playBtn.onclick = () => {
                overlay.classList.remove('active');
                onPlay(item);
            };
        }

        // Favorite Toggle
        const updateFavIcon = async () => {
            const isFav = await DB.isFavorite(item.url);
            favBtn.innerHTML = isFav 
                ? '<span class="material-icons-outlined" style="color:var(--accent-gold)">favorite</span>'
                : '<span class="material-icons-outlined">favorite_border</span>';
        };
        await updateFavIcon();
        
        favBtn.onclick = async () => {
            await DB.toggleFavorite(item);
            await updateFavIcon();
        };

        // Cast
        const btnCast = document.getElementById('btn-cast');
        btnCast.onclick = () => {
            if(castMedia(item.url, item.name, item.logo)) {
                overlay.classList.remove('active');
            } else {
                alert("Conecte-se ao Chromecast primeiro clicando no ícone Cast no topo da tela ou verifique sua conexão.");
            }
        };

        // Watch Party
        const btnParty = document.getElementById('btn-party');
        btnParty.onclick = async () => {
            const code = prompt("Deseja criar uma sala ou entrar em uma? Deixe em branco para criar, ou digite o código de 6 dígitos para entrar:");
            if (code && code.length === 6) {
                overlay.classList.remove('active');
                await WatchParty.joinParty(code);
            } else if (code === "") {
                overlay.classList.remove('active');
                await WatchParty.createParty(item);
            }
        };

        // Fetch TMDB data
        let tmdbData = null;
        if (type === 'movie') tmdbData = await TmdbApi.searchMovie(item.name);
        if (type === 'series') tmdbData = await TmdbApi.searchTvShow(item.name);

        if (tmdbData) {
            const details = await TmdbApi.getDetails(tmdbData.id, type);
            if (details) {
                overview.textContent = details.overview;
                if(details.posterPath) poster.src = details.posterPath;
                if(details.backdropPath) {
                    backdrop.style.backgroundImage = `url('${details.backdropPath}')`;
                    // Save to item so Home Banner can use it
                    item.backdropPath = details.backdropPath;
                }
                rating.innerHTML = `<span class="material-icons-outlined">star</span> ${details.rating}`;
                if(details.releaseDate) year.textContent = details.releaseDate.split('-')[0];
                if(details.genres) genres.textContent = details.genres;

                if (details.cast && details.cast.length > 0) {
                    details.cast.forEach(c => {
                        const actorEl = document.createElement('div');
                        actorEl.className = 'cast-member';
                        actorEl.innerHTML = `
                            <img src="${c.profilePath || 'https://via.placeholder.com/100x100?text=No+Photo'}" alt="${c.name}">
                            <div class="cast-name">${c.name}</div>
                            <div class="cast-character">${c.character}</div>
                        `;
                        castContainer.appendChild(actorEl);
                    });
                } else {
                    document.getElementById('detail-cast-container').style.display = 'none';
                }
            }
        } else {
            overview.textContent = "Nenhum detalhe adicional encontrado no TMDB para este título.";
            document.getElementById('detail-cast-container').style.display = 'none';
        }
    }

    static hideDetails() {
        document.getElementById('detail-overlay').classList.remove('active');
    }
}

// Global UI Fluidity: Auto smooth scroll on focus (simulating Android TV FocusHelper)
document.addEventListener('focus', function(e) {
    if (e.target.tabIndex === 0 && !document.getElementById('detail-overlay').classList.contains('active')) {
        // Smooth scroll keeping element centered
        e.target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}, true);

// D-Pad / Arrow Key Spatial Navigation
document.addEventListener('keydown', function(e) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    
    // Don't interfere if an input is focused or a modal is active (unless it's the specific modal elements)
    if (document.activeElement.tagName === 'INPUT') return;

    const focusables = Array.from(document.querySelectorAll('[tabindex="0"]:not([disabled])')).filter(el => {
        // Only consider elements that are currently visible
        return el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== 'hidden';
    });

    if (focusables.length === 0) return;

    const current = document.activeElement;
    if (!focusables.includes(current)) {
        // If nothing is focused, focus the first visible focusable
        focusables[0].focus();
        e.preventDefault();
        return;
    }

    const currentRect = current.getBoundingClientRect();
    let bestMatch = null;
    let minDistance = Infinity;

    focusables.forEach(target => {
        if (target === current) return;
        const targetRect = target.getBoundingClientRect();

        let dx = 0;
        let dy = 0;
        let validDirection = false;

        if (e.key === 'ArrowUp' && targetRect.bottom <= currentRect.top) {
            dx = (targetRect.left + targetRect.width / 2) - (currentRect.left + currentRect.width / 2);
            dy = currentRect.top - targetRect.bottom;
            validDirection = true;
        } else if (e.key === 'ArrowDown' && targetRect.top >= currentRect.bottom) {
            dx = (targetRect.left + targetRect.width / 2) - (currentRect.left + currentRect.width / 2);
            dy = targetRect.top - currentRect.bottom;
            validDirection = true;
        } else if (e.key === 'ArrowLeft' && targetRect.right <= currentRect.left) {
            dx = currentRect.left - targetRect.right;
            dy = (targetRect.top + targetRect.height / 2) - (currentRect.top + currentRect.height / 2);
            validDirection = true;
        } else if (e.key === 'ArrowRight' && targetRect.left >= currentRect.right) {
            dx = targetRect.left - currentRect.right;
            dy = (targetRect.top + targetRect.height / 2) - (currentRect.top + currentRect.height / 2);
            validDirection = true;
        }

        if (validDirection) {
            // Give higher penalty to orthogonal distance to prefer items strictly in the direction
            const distance = Math.pow(dx, 2) * (e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 2 : 1) 
                           + Math.pow(dy, 2) * (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? 2 : 1);
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = target;
            }
        }
    });

    if (bestMatch) {
        bestMatch.focus();
        e.preventDefault();
    }
});
