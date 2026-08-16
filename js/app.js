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

    // Remote Sync Logic
    let syncUnsubscribe = null;
    
    document.getElementById('btn-remote-sync').addEventListener('click', async () => {
        UIManager.showModal('modal-remote-sync');
        const codeDisplay = document.getElementById('sync-code-display');
        const statusText = document.getElementById('sync-status');
        const spinner = document.getElementById('sync-spinner');
        
        codeDisplay.textContent = 'GERANDO...';
        statusText.textContent = 'Conectando ao servidor...';
        statusText.style.color = 'var(--text-secondary)';
        spinner.style.display = 'inline-block';

        try {
            const db = firebase.firestore();
            const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
            
            await db.collection('devices').doc(code).set({
                status: 'waiting',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            codeDisplay.textContent = code.substring(0,3) + ' ' + code.substring(3);
            statusText.textContent = 'Aguardando envio pelo painel remoto...';
            
            syncUnsubscribe = db.collection('devices').doc(code).onSnapshot(async (doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.processed === false) {
                        statusText.textContent = 'Recebendo lista, por favor aguarde...';
                        statusText.style.color = 'var(--accent-gold)';
                        try {
                            if (data.type === 'xtream') {
                                await XtreamAPI.fetchAndParse(data.source, data.username, data.password);
                                
                                // Auto-resolve EPG
                                const baseUrl = data.source.endsWith('/') ? data.source.slice(0, -1) : data.source;
                                const epgUrl = `${baseUrl}/xmltv.php?username=${data.username}&password=${data.password}`;
                                await EPGParser.setStoredEpgUrl(epgUrl);
                                document.getElementById('input-epg-url').value = epgUrl;
                            } else {
                                await M3UParser.fetchAndParse(data.source);
                            }
                            
                            await DB.saveSource({
                                name: data.name || 'Lista Remota',
                                url: data.source,
                                type: data.type === 'xtream' ? 'XTREAM' : 'M3U',
                                username: data.username,
                                password: data.password
                            });
                            
                            await db.collection('devices').doc(code).update({ processed: true });
                            
                            statusText.textContent = 'Sincronizado com Sucesso!';
                            statusText.style.color = 'var(--status-success)';
                            spinner.style.display = 'none';
                            
                            setTimeout(() => {
                                UIManager.hideModal('modal-remote-sync');
                                UIManager.renderSources('sources-list');
                                loadViewData(document.querySelector('.nav-item.active').getAttribute('data-view'));
                            }, 2000);
                            
                            if (syncUnsubscribe) {
                                syncUnsubscribe();
                                syncUnsubscribe = null;
                            }
                            
                        } catch (e) {
                            console.error("Sync error:", e);
                            statusText.textContent = 'Erro ao sincronizar: ' + e.message;
                            statusText.style.color = 'var(--primary-red)';
                            await db.collection('devices').doc(code).update({ status: 'error', error: e.message });
                        }
                    }
                }
            });

        } catch (e) {
            console.error(e);
            codeDisplay.textContent = 'ERRO';
            statusText.textContent = 'Falha ao gerar código: ' + e.message;
            statusText.style.color = 'var(--primary-red)';
            spinner.style.display = 'none';
        }
    });

    document.querySelectorAll('.modal-close-sync').forEach(btn => {
        btn.addEventListener('click', () => {
            UIManager.hideModal('modal-remote-sync');
            if (syncUnsubscribe) {
                syncUnsubscribe();
                syncUnsubscribe = null;
            }
        });
    });

    const btnForceUpdate = document.getElementById('btn-force-update');
    if (btnForceUpdate) {
        btnForceUpdate.addEventListener('click', async () => {
            const btn = document.getElementById('btn-force-update');
            btn.textContent = 'Carregando...';
            btn.disabled = true;
            document.getElementById('loading-overlay').style.display = 'flex';
        
        try {
            const sources = await DB.getSources();
            if(!sources || sources.length === 0) {
                alert('Nenhuma fonte configurada.');
                return;
            }
            let updated = false;
            for(let source of sources) {
                if(source.url && source.url !== 'local_file') {
                    const strategies = [
                        { name: 'Direct Fetch', url: source.url },
                        { name: 'Vercel Proxy', url: `/api/proxy?url=${encodeURIComponent(source.url)}` },
                        { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}` },
                        { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(source.url)}` }
                    ];

                    for (let strategy of strategies) {
                        try {
                            // true = CLear the DB completely to avoid duplicates, just like adding a new list
                            await M3UParser.fetchAndParse(strategy.url, true);
                            source.last_updated = Date.now();
                            await DB.saveSource(source);
                            updated = true;
                            break;
                        } catch (e) {}
                    }
                }
            }
            if(updated) {
                alert('Conteúdos atualizados com sucesso!');
                window.dispatchEvent(new Event('sourcesChanged'));
            } else {
                alert('Nenhum conteúdo pôde ser atualizado. Verifique a URL da lista.');
            }
        } catch(e) {
            console.error(e);
            alert('Erro: ' + e.message);
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
            btn.textContent = 'Atualizar Conteúdos (Forçar)';
            btn.disabled = false;
        }
    });
}

    // Tabs Logic
    const tabM3u = document.getElementById('tab-m3u');
    const tabXtream = document.getElementById('tab-xtream');
    const inputsM3u = document.getElementById('source-inputs-m3u');
    const inputsXtream = document.getElementById('source-inputs-xtream');

    let currentSourceType = 'm3u';

    if (tabM3u && tabXtream) {
        tabM3u.addEventListener('click', () => {
            tabM3u.classList.add('active');
            tabXtream.classList.remove('active');
            inputsM3u.style.display = 'block';
            inputsXtream.style.display = 'none';
            currentSourceType = 'm3u';
        });
        tabXtream.addEventListener('click', () => {
            tabXtream.classList.add('active');
            tabM3u.classList.remove('active');
            inputsXtream.style.display = 'block';
            inputsM3u.style.display = 'none';
            currentSourceType = 'xtream';
        });
    }

    document.getElementById('btn-save-source').addEventListener('click', async () => {
        const nameInput = document.getElementById('input-source-name');
        const btn = document.getElementById('btn-save-source');
        
        if (!nameInput.value) {
            alert('Insira um nome para a lista.');
            return;
        }

        btn.textContent = 'Carregando...';
        btn.disabled = true;
        document.getElementById('loading-overlay').style.display = 'flex';

        try {
            let parsedData;
            let finalUrl = '';
            
            if (currentSourceType === 'm3u') {
                const urlInput = document.getElementById('input-source-url');
                const fileInput = document.getElementById('input-source-file');
                if (!urlInput.value && (!fileInput.files || fileInput.files.length === 0)) {
                    throw new Error('Insira uma URL M3U ou selecione um arquivo.');
                }
                
                if (fileInput.files && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const m3uText = await file.text();
                    parsedData = await M3UParser.parse(m3uText);
                    finalUrl = 'local_file';
                } else {
                    finalUrl = urlInput.value;
                    let finalErrorDetails = [];
                    const strategies = [
                        { name: 'Direct Fetch', url: finalUrl },
                        { name: 'Vercel Proxy', url: `/api/proxy?url=${encodeURIComponent(finalUrl)}` },
                        { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(finalUrl)}` },
                        { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(finalUrl)}` }
                    ];

                    let success = false;
                    for (let strategy of strategies) {
                        try {
                            console.log(`[IPTV Web] Tentando carregar M3U via: ${strategy.name}`);
                            parsedData = await M3UParser.fetchAndParse(strategy.url);
                            success = true;
                            break;
                        } catch (e) {
                            finalErrorDetails.push(`${strategy.name} falhou: ${e.code || e.message}`);
                        }
                    }
                    if (!success) {
                        let errorMsg = '❌ Falha ao carregar a lista M3U.\n\nDetalhes:\n' + finalErrorDetails.join('\n');
                        errorMsg += '\n\n✅ SOLUÇÃO GARANTIDA: Baixe o arquivo .m3u da sua lista e faça o upload.';
                        alert(errorMsg);
                        throw new Error("All fetch strategies failed.");
                    }
                }
            } else if (currentSourceType === 'xtream') {
                const hostInput = document.getElementById('input-xtream-host');
                const userInput = document.getElementById('input-xtream-user');
                const passInput = document.getElementById('input-xtream-pass');
                
                if (!hostInput.value || !userInput.value || !passInput.value) {
                    throw new Error('Preencha todos os campos do Xtream Codes.');
                }
                
                await XtreamAPI.fetchAndParse(hostInput.value, userInput.value, passInput.value);
                finalUrl = hostInput.value;

                // Auto-resolve EPG
                const baseUrl = finalUrl.endsWith('/') ? finalUrl.slice(0, -1) : finalUrl;
                const epgUrl = `${baseUrl}/xmltv.php?username=${userInput.value}&password=${passInput.value}`;
                await EPGParser.setStoredEpgUrl(epgUrl);
                document.getElementById('input-epg-url').value = epgUrl;
            }
            
            await DB.saveSource({ 
                name: nameInput.value, 
                url: finalUrl,
                type: currentSourceType === 'xtream' ? 'XTREAM' : 'M3U',
                username: currentSourceType === 'xtream' ? document.getElementById('input-xtream-user').value : undefined,
                password: currentSourceType === 'xtream' ? document.getElementById('input-xtream-pass').value : undefined,
                last_updated: Date.now()
            });
            
            UIManager.hideModal('modal-add-source');
            UIManager.renderSources('sources-list');
            loadViewData(document.querySelector('.nav-item.active').getAttribute('data-view'));
            alert('Fonte adicionada com sucesso!');
            nameInput.value = '';
            document.getElementById('input-source-url').value = '';
            document.getElementById('input-source-file').value = '';
            document.getElementById('input-xtream-host').value = '';
            document.getElementById('input-xtream-user').value = '';
            document.getElementById('input-xtream-pass').value = '';
            
            // Reload settings to show new source
            loadViewData('settings');

        } catch (error) {
            console.error('Save Source Error:', error);
            if(error.message !== "All fetch strategies failed.") {
                alert('Erro ao processar fonte: ' + error.message);
            }
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
            btn.textContent = 'Adicionar Fonte';
            btn.disabled = false;
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
            // Home tab: get small samples from DB.getPaginated
            const moviesSample = await DB.getPaginated('movies', null, 0, 10);
            const seriesSample = await DB.getPaginated('series', null, 0, 10);
            const history = await DB.getHistory();
            
            const trending = [...moviesSample, ...seriesSample].sort(() => 0.5 - Math.random());
            
            UIManager.renderCarousel('carousel-continue', history, (item) => Player.play(item));
            UIManager.renderCarousel('carousel-trending', trending, (item) => {
                const type = item.seasons ? 'series' : 'movie';
                UIManager.showDetails(item, type, (i) => Player.play(i));
            });

            if(moviesSample.length > 0) {
                const heroMovie = moviesSample[Math.floor(Math.random() * moviesSample.length)];
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
            UIManager.renderFilters('filters-movies', 'movies', (group) => {
                UIManager.renderGridPaginated('grid-movies', async (page, pageSize) => {
                    if (group === '__FAVORITES__') return (await DB.getFavorites()).slice(page * pageSize, (page + 1) * pageSize);
                    return await DB.getPaginated('movies', group, page, pageSize);
                }, (item) => UIManager.showDetails(item, 'movie', (i) => Player.play(i)));
            });
            UIManager.renderGridPaginated('grid-movies', async (page, pageSize) => {
                return await DB.getPaginated('movies', null, page, pageSize);
            }, (item) => UIManager.showDetails(item, 'movie', (i) => Player.play(i)));

        } else if (viewId === 'series') {
            UIManager.renderFilters('filters-series', 'series', (group) => {
                UIManager.renderGridPaginated('grid-series', async (page, pageSize) => {
                    if (group === '__FAVORITES__') return (await DB.getFavorites()).slice(page * pageSize, (page + 1) * pageSize);
                    return await DB.getPaginated('series', group, page, pageSize);
                }, (item) => UIManager.showDetails(item, 'series', (i) => Player.play(i)));
            });
            UIManager.renderGridPaginated('grid-series', async (page, pageSize) => {
                return await DB.getPaginated('series', null, page, pageSize);
            }, (item) => UIManager.showDetails(item, 'series', (i) => Player.play(i)));

        } else if (viewId === 'live') {
            const epgUrl = await EPGParser.getStoredEpgUrl();
            if (epgUrl && !currentEpgData) {
                try { currentEpgData = await EPGParser.fetchAndParse(epgUrl); } 
                catch(e) { console.error("Could not load EPG"); }
            }

            const playChannel = (item) => {
                Player.play(item);
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

            UIManager.renderFilters('filters-live', 'channels', (group) => {
                UIManager.renderGridPaginated('grid-live', async (page, pageSize) => {
                    if (group === '__FAVORITES__') return (await DB.getFavorites()).slice(page * pageSize, (page + 1) * pageSize);
                    return await DB.getPaginated('channels', group, page, pageSize);
                }, playChannel);
            });
            UIManager.renderGridPaginated('grid-live', async (page, pageSize) => {
                return await DB.getPaginated('channels', null, page, pageSize);
            }, playChannel);

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
    const setupSearch = (inputId, gridId, type) => {
        let searchTimeout;
        document.getElementById(inputId).addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                const query = e.target.value.trim();
                if(!query) {
                    // Reset to unfiltered
                    loadViewData(type === 'channels' ? 'live' : type);
                    return;
                }
                const items = await DB.search(type, query);
                UIManager.renderGrid(gridId, items, (item) => {
                    if(type === 'channels') Player.play(item);
                    else UIManager.showDetails(item, type, (i) => Player.play(i));
                });
            }, 500);
        });
    };

    setupSearch('search-movies', 'grid-movies', 'movies');
    setupSearch('search-series', 'grid-series', 'series');
    setupSearch('search-live', 'grid-live', 'channels');

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
                
                // Dispara sincronização em segundo plano
                syncSourcesBackground();
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

    async function syncSourcesBackground() {
        const sources = await DB.getSources();
        if(!sources || sources.length === 0) return;
        
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const now = Date.now();
        let updated = false;

        for(let source of sources) {
            if(source.url && source.url !== 'local_file') {
                if (source.last_updated && (now - source.last_updated < TWENTY_FOUR_HOURS)) {
                    console.log(`[Background Sync] Skipped ${source.name} (updated less than 24h ago).`);
                    continue;
                }

                try {
                    console.log(`[Background Sync] Checking updates for ${source.name}...`);
                    // We try to fetch the list silently
                    const strategies = [
                        { name: 'Direct Fetch', url: source.url },
                        { name: 'Vercel Proxy', url: `/api/proxy?url=${encodeURIComponent(source.url)}` },
                        { name: 'AllOrigins', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}` },
                        { name: 'CorsProxy.io', url: `https://corsproxy.io/?${encodeURIComponent(source.url)}` }
                    ];

                    let parsedData = null;
                    for (let strategy of strategies) {
                        try {
                            // false = DO NOT clear the DB, just parse and we will append/overwrite
                            parsedData = await M3UParser.fetchAndParse(strategy.url, false);
                            break; // Success
                        } catch (e) {
                            // Silently fail to next strategy
                        }
                    }

                    if(parsedData && parsedData.channels && parsedData.channels.length > 0) {
                        // Very simple check: if channel length differs or just overwrite blindly in background
                        // A true delta sync would require hashing, but blind overwrite in background is safe enough with localForage
                        await DB.saveChannels(parsedData.channels);
                        await DB.saveMovies(parsedData.movies);
                        await DB.saveSeries(parsedData.series);
                        
                        // Update last_updated timestamp for the source
                        source.last_updated = Date.now();
                        await DB.saveSource(source);

                        updated = true;
                    }
                } catch(e) {
                    console.warn(`[Background Sync] Failed for ${source.name}`, e);
                }
            }
        }
        
        if(updated) {
            console.log('[Background Sync] Lists updated in background.');
            // Dispatch event to refresh current view if needed
            window.dispatchEvent(new Event('sourcesChanged'));
            
            // Show a non-intrusive toast
            const toast = document.createElement('div');
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.right = '24px';
            toast.style.background = 'var(--accent-gold)';
            toast.style.color = '#000';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '8px';
            toast.style.fontWeight = 'bold';
            toast.style.zIndex = '9999';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
            toast.innerText = 'Listas atualizadas em segundo plano!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }
    }

    async function bootApp() {
        const statusText = document.getElementById('splash-status-text');
        if (statusText) statusText.textContent = "Verificando configurações remotas...";

        try {
            const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
            if (db) {
                const settingsDoc = await db.collection('settings').doc('config').get();
                if (settingsDoc.exists) {
                    const data = settingsDoc.data();
                    if (data.isMaintenance) {
                        document.getElementById('splash-screen').style.display = 'none';
                        document.getElementById('maintenance-screen').style.display = 'flex';
                        document.getElementById('maintenance-message').textContent = data.maintenanceMessage || "Estamos em manutenção. Volte mais tarde.";
                        return; // Halt boot sequence
                    }
                    if (data.requireUpdate) {
                        document.getElementById('splash-screen').style.display = 'none';
                        document.getElementById('update-screen').style.display = 'flex';
                        document.getElementById('update-message').textContent = data.updateMessage || "Uma nova atualização é obrigatória.";
                        return; // Halt boot sequence
                    }
                }
            }
        } catch (e) {
            console.warn("Falha ao checar settings remotos. Continuando...", e);
        }

        if (statusText) statusText.textContent = "Verificando Licença...";

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
