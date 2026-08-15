document.addEventListener('DOMContentLoaded', async () => {
    // Basic Routing/Navigation
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const views = document.querySelectorAll('.view-section');

    function switchView(viewId) {
        // Update active class on nav
        navItems.forEach(item => {
            if (item.getAttribute('data-view') === viewId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Show corresponding view
        views.forEach(view => {
            if (view.id === `view-${viewId}`) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        });

        loadViewData(viewId);
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.getAttribute('data-view'));
        });
        
        item.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') switchView(item.getAttribute('data-view'));
        });
    });

    // Modals
    document.getElementById('btn-add-source').addEventListener('click', () => UIManager.showModal('modal-add-source'));
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => UIManager.hideModal('modal-add-source'));
    });

    // Detail Overlay
    document.getElementById('btn-close-detail').addEventListener('click', () => {
        UIManager.hideDetails();
    });

    document.getElementById('btn-save-source').addEventListener('click', async () => {
        const nameInput = document.getElementById('input-source-name');
        const urlInput = document.getElementById('input-source-url');
        const fileInput = document.getElementById('input-source-file');
        
        if (nameInput.value && (urlInput.value || (fileInput.files && fileInput.files.length > 0))) {
            const btn = document.getElementById('btn-save-source');
            btn.textContent = 'Carregando...';
            btn.disabled = true;

            try {
                let parsedData;
                
                if (fileInput.files && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const m3uText = await file.text();
                    parsedData = await M3UParser.parse(m3uText);
                } else {
                    let finalErrorDetails = [];
                    const strategies = [
                        { name: 'Direct Fetch', url: urlInput.value },
                        { name: 'Vercel Proxy', url: `/api/proxy?url=${encodeURIComponent(urlInput.value)}` },
                        { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput.value)}` },
                        { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(urlInput.value)}` }
                    ];

                    let success = false;
                    for (let strategy of strategies) {
                        try {
                            console.log(`[IPTV Web] Tentando carregar via: ${strategy.name}`);
                            parsedData = await M3UParser.fetchAndParse(strategy.url);
                            success = true;
                            break;
                        } catch (e) {
                            console.warn(`[IPTV Web] Falha na estratégia ${strategy.name}:`, e.message);
                            finalErrorDetails.push(`${strategy.name} falhou: ${e.code || e.message}`);
                        }
                    }

                    if (!success) {
                        let errorMsg = '❌ Falha ao carregar a lista. Nenhuma rota de conexão funcionou.\n\nDetalhes do Diagnóstico:\n';
                        finalErrorDetails.forEach(d => errorMsg += `- ${d}\n`);
                        
                        if (finalErrorDetails.some(d => d.includes('UPSTREAM_ERROR') || d.match(/HTTP_(403|401|406)/))) {
                            errorMsg += '\n🛑 DIAGNÓSTICO FINAL: O servidor de origem (seu provedor IPTV) recusou a requisição. Ele está bloqueando o acesso do nosso servidor Vercel (WAF/Anti-Scraper) ou exigindo autenticação especial. NÃO é um erro de CORS do navegador.';
                        } else if (finalErrorDetails.every(d => d.includes('NETWORK_CORS_ERROR'))) {
                            errorMsg += '\n🛑 DIAGNÓSTICO FINAL: Erro de CORS estrito ou falha de rede. Nenhum proxy conseguiu alcançar a URL de forma limpa.';
                        } else if (finalErrorDetails.some(d => d.includes('TIMEOUT'))) {
                            errorMsg += '\n🛑 DIAGNÓSTICO FINAL: O servidor IPTV demorou muito para responder (Timeout > 30s) e a requisição foi abortada.';
                        }
                        
                        errorMsg += '\n\n✅ SOLUÇÃO GARANTIDA: Baixe o arquivo .m3u da sua lista e utilize a opção "Ou faça upload do arquivo" logo abaixo.';
                        alert(errorMsg);
                        throw new Error("All fetch strategies failed.");
                    }
                }
                
                await DB.saveChannels(parsedData.channels);
                await DB.saveMovies(parsedData.movies);
                await DB.saveSeries(parsedData.series);
                
                await DB.saveSource({ 
                    name: nameInput.value, 
                    url: fileInput.files && fileInput.files.length > 0 ? 'local_file' : urlInput.value 
                });
                
                UIManager.hideModal('modal-add-source');
                UIManager.renderSources('sources-list');
                loadViewData(document.querySelector('.nav-item.active').getAttribute('data-view'));
            } catch (error) {
                if (error.message !== "All fetch strategies failed.") {
                    alert('Erro inesperado ao processar a lista: ' + error.message);
                }
            } finally {
                btn.textContent = 'Salvar';
                btn.disabled = false;
                nameInput.value = '';
                urlInput.value = '';
                fileInput.value = '';
            }
        } else {
            alert('Insira um nome e uma URL ou Arquivo.');
        }
    });

    window.addEventListener('sourcesChanged', () => {
        loadViewData(document.querySelector('.nav-item.active').getAttribute('data-view'));
    });

    // Data Loaders with Filters
    let currentMovies = [];
    let currentSeries = [];
    let currentChannels = [];

    // EPG Logic
    document.getElementById('btn-save-epg').addEventListener('click', async () => {
        const url = document.getElementById('input-epg-url').value;
        if (url) {
            const btn = document.getElementById('btn-save-epg');
            btn.textContent = 'Carregando...';
            try {
                try {
                    await EPGParser.fetchAndParse(url);
                } catch (e1) {
                    console.warn("Direct EPG fetch failed, trying Vercel proxy...");
                    try {
                        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
                        await EPGParser.fetchAndParse(proxyUrl);
                    } catch (e2) {
                        console.warn("Vercel proxy failed, trying AllOrigins...");
                        try {
                            const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                            await EPGParser.fetchAndParse(allOriginsUrl);
                        } catch (e3) {
                            console.warn("AllOrigins failed, trying CorsProxy.io...");
                            const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                            await EPGParser.fetchAndParse(corsProxyUrl);
                        }
                    }
                }
                
                await EPGParser.setStoredEpgUrl(url);
                alert('EPG carregado com sucesso!');
            } catch (error) {
                alert('Erro ao carregar EPG: ' + error.message);
            } finally {
                btn.textContent = 'Salvar EPG';
            }
        }
    });

    let currentEpgData = null;

    async function loadViewData(viewId) {
        if (viewId === 'home') {
            const movies = await DB.getMovies();
            const series = await DB.getSeries();
            const history = await DB.getHistory();
            
            // Randomize trending or use newly added
            const trending = [...movies, ...series].sort(() => 0.5 - Math.random());
            
            UIManager.renderCarousel('carousel-continue', history, (item) => Player.play(item));
            UIManager.renderCarousel('carousel-trending', trending, (item) => {
                const type = movies.includes(item) ? 'movie' : 'series';
                UIManager.showDetails(item, type, (i) => Player.play(i));
            });

            // Set a random movie as Hero Banner, fetching its backdrop first
            if(movies.length > 0) {
                const heroMovie = movies[Math.floor(Math.random() * Math.min(10, movies.length))];
                // Fetch details to ensure we get the backdrop
                const tmdbData = await TmdbApi.searchMovie(heroMovie.name);
                if(tmdbData) {
                    const details = await TmdbApi.getDetails(tmdbData.id, 'movie');
                    if(details && details.backdropPath) heroMovie.backdropPath = details.backdropPath;
                    if(details && details.overview) heroMovie.overview = details.overview;
                }
                UIManager.renderHomeBanner(heroMovie, (item) => {
                    UIManager.showDetails(item, 'movie', (i) => Player.play(i));
                });
            }

        } else if (viewId === 'movies') {
            currentMovies = await DB.getMovies();
            UIManager.renderFilters('filters-movies', currentMovies, (group, favUrls) => {
                let filtered = currentMovies;
                if (group === '__FAVORITES__') filtered = currentMovies.filter(m => favUrls.includes(m.url));
                else if (group) filtered = currentMovies.filter(m => m.group === group);
                UIManager.renderGrid('grid-movies', filtered, (item) => UIManager.showDetails(item, 'movie', (i) => Player.play(i)));
            });
            UIManager.renderGrid('grid-movies', currentMovies, (item) => UIManager.showDetails(item, 'movie', (i) => Player.play(i)));

        } else if (viewId === 'series') {
            currentSeries = await DB.getSeries();
            UIManager.renderFilters('filters-series', currentSeries, (group, favUrls) => {
                let filtered = currentSeries;
                if (group === '__FAVORITES__') filtered = currentSeries.filter(s => favUrls.includes(s.url));
                else if (group) filtered = currentSeries.filter(s => s.group === group);
                UIManager.renderGrid('grid-series', filtered, (item) => UIManager.showDetails(item, 'series', (i) => Player.play(i)));
            });
            UIManager.renderGrid('grid-series', currentSeries, (item) => UIManager.showDetails(item, 'series', (i) => Player.play(i)));

        } else if (viewId === 'live') {
            currentChannels = await DB.getChannels();
            
            // Load EPG if available
            const epgUrl = await EPGParser.getStoredEpgUrl();
            if (epgUrl && !currentEpgData) {
                try {
                    currentEpgData = await EPGParser.fetchAndParse(epgUrl);
                } catch(e) { console.error("Could not load EPG in background"); }
            }

            const playChannel = (item) => {
                Player.play(item);
                // Show Now Playing EPG
                const epgBox = document.getElementById('epg-now-playing');
                if (currentEpgData && item.tvgId && currentEpgData[item.tvgId]) {
                    const prog = currentEpgData[item.tvgId].find(p => p.isNowPlaying);
                    if (prog) {
                        epgBox.style.display = 'block';
                        epgBox.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <h4 style="color:var(--accent-gold); margin-bottom:4px;">Transmitindo Agora: ${prog.title}</h4>
                                    <p style="font-size:14px; color:var(--text-secondary);">${prog.description}</p>
                                </div>
                                <div style="text-align:right; font-size:14px;">
                                    <span>${prog.start.getHours()}:${String(prog.start.getMinutes()).padStart(2, '0')}</span> - 
                                    <span>${prog.stop.getHours()}:${String(prog.stop.getMinutes()).padStart(2, '0')}</span>
                                </div>
                            </div>
                        `;
                    } else { epgBox.style.display = 'none'; }
                } else { epgBox.style.display = 'none'; }
            };

            UIManager.renderFilters('filters-live', currentChannels, (group, favUrls) => {
                let filtered = currentChannels;
                if (group === '__FAVORITES__') filtered = currentChannels.filter(c => favUrls.includes(c.url));
                else if (group) filtered = currentChannels.filter(c => c.group === group);
                UIManager.renderGrid('grid-live', filtered, playChannel);
            });
            UIManager.renderGrid('grid-live', currentChannels, playChannel);

        } else if (viewId === 'favorites') {
            const favs = await DB.getFavorites();
            UIManager.renderGrid('grid-favorites', favs, (item) => Player.play(item)); 

        } else if (viewId === 'history') {
            const history = await DB.getHistory();
            UIManager.renderGrid('grid-history', history, (item) => Player.play(item));

        } else if (viewId === 'settings') {
            UIManager.renderSources('sources-list');
            const epgUrl = await EPGParser.getStoredEpgUrl();
            if (epgUrl) document.getElementById('input-epg-url').value = epgUrl;
        }
    }

    // Live search functionality
    const setupSearch = (inputId, getItems, gridId, type) => {
        document.getElementById(inputId).addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase();
            const items = await getItems();
            const filtered = items.filter(i => i.name.toLowerCase().includes(query));
            UIManager.renderGrid(gridId, filtered, (item) => {
                if(type === 'channel') Player.play(item);
                else UIManager.showDetails(item, type, (i) => Player.play(i));
            });
        });
    };

    setupSearch('search-movies', () => currentMovies, 'grid-movies', 'movie');
    setupSearch('search-series', () => currentSeries, 'grid-series', 'series');
    // Profiles System
    const profilesOverlay = document.getElementById('profiles-overlay');
    const appContainer = document.getElementById('app-container');
    const profilesList = document.getElementById('profiles-list');

    async function loadProfiles() {
        const profiles = await ProfileManager.getProfiles();
        profilesList.innerHTML = '';
        
        profiles.forEach(profile => {
            const card = document.createElement('div');
            card.className = 'profile-card';
            card.tabIndex = 0;
            card.innerHTML = `
                <img src="${profile.avatar}" class="profile-avatar" alt="${profile.name}">
                <span class="profile-name">${profile.name}</span>
            `;
            
            const selectProfile = async () => {
                await ProfileManager.setActiveProfile(profile);
                profilesOverlay.classList.remove('active');
                appContainer.style.opacity = '1';
                appContainer.style.pointerEvents = 'all';
                
                // Initialize after profile is selected so history/favs load for this profile
                switchView('home');
                UIManager.renderSources('sources-list');
            };

            card.addEventListener('click', selectProfile);
            card.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') selectProfile();
            });
            profilesList.appendChild(card);
        });
    }

    // Parental PIN
    let pendingAction = null;
    document.getElementById('btn-set-pin').addEventListener('click', async () => {
        const hasPin = await ParentalControl.hasPin();
        const pin = prompt(hasPin ? "O Controle Parental já está ativo. Digite o novo PIN (4 dígitos) para alterar:" : "Crie um PIN (4 dígitos) para bloquear categorias de adultos:");
        if (pin && pin.length === 4) {
            await ParentalControl.setPin(pin);
            alert("PIN configurado com sucesso!");
        } else if (pin) {
            alert("O PIN deve ter exatamente 4 dígitos numéricos.");
        }
    });

    const pinModal = document.getElementById('modal-pin');
    const pinInput = document.getElementById('input-verify-pin');

    document.querySelectorAll('.modal-close-pin').forEach(btn => {
        btn.addEventListener('click', () => {
            pinModal.classList.remove('active');
            pendingAction = null;
        });
    });

    document.getElementById('btn-submit-pin').addEventListener('click', async () => {
        const isValid = await ParentalControl.verifyPin(pinInput.value);
        if (isValid) {
            pinModal.classList.remove('active');
            if (pendingAction) pendingAction();
            pendingAction = null;
        } else {
            alert("PIN incorreto!");
            pinInput.value = '';
        }
    });

    // Wrapped switch view that checks for Adult content PIN when clicking a filter
    const originalFilterClick = UIManager.renderFilters;
    UIManager.renderFilters = function(containerId, items, onFilter) {
        // Redefine to intercept group selection
        originalFilterClick.call(UIManager, containerId, items, async (group) => {
            if (group && ParentalControl.isAdultContent(group)) {
                const hasPin = await ParentalControl.hasPin();
                if (hasPin) {
                    pendingAction = () => onFilter(group);
                    pinInput.value = '';
                    pinModal.classList.add('active');
                    pinInput.focus();
                    return;
                }
            }
            onFilter(group);
        });
    }

    // App Boot Sequence (Firebase License Validation)
    const splashScreen = document.getElementById('splash-screen');
    const loginContainer = document.getElementById('login-container');
    const loadingContainer = document.getElementById('splash-loading');
    const inputLicense = document.getElementById('input-license');
    const btnValidate = document.getElementById('btn-validate');
    const loginError = document.getElementById('login-error');
    const deviceLimitContainer = document.getElementById('device-limit-container');
    const btnForceLogin = document.getElementById('btn-force-login');

    let currentTryingKey = null;

    async function proceedToApp() {
        splashScreen.classList.remove('active');
        // Initial setup
        loadProfiles();
    }

    function showLogin(errorMsg = null) {
        loadingContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        if (errorMsg) {
            loginError.textContent = errorMsg;
            loginError.style.display = 'block';
        } else {
            loginError.style.display = 'none';
        }
    }

    async function attemptLogin(key, force = false) {
        loginContainer.style.display = 'none';
        loadingContainer.style.display = 'block';
        deviceLimitContainer.style.display = 'none';
        
        try {
            const isValid = await LicenseManager.validateLicense(key, force);
            if (isValid) {
                proceedToApp();
            }
        } catch (error) {
            if (error.code === "DEVICE_LIMIT") {
                showLogin();
                deviceLimitContainer.style.display = 'block';
                currentTryingKey = key;
            } else {
                showLogin(error.message);
            }
        }
    }

    btnValidate.addEventListener('click', () => {
        const key = inputLicense.value.trim();
        if (key) attemptLogin(key, false);
    });

    btnForceLogin.addEventListener('click', () => {
        if (currentTryingKey) attemptLogin(currentTryingKey, true);
    });

    async function bootApp() {
        // Temporary timeout to simulate loading visually
        setTimeout(async () => {
            const savedLicense = await LicenseManager.getSavedLicense();
            if (savedLicense) {
                attemptLogin(savedLicense, false);
            } else {
                showLogin();
            }
        }, 1000);
    }

    // Start Boot
    bootApp();
});
