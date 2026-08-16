// ----------------------------------------------------
// Google Cast (Chromecast) Integration
// ----------------------------------------------------
let castSession = null;

window.__onGCastApiAvailable = function(isAvailable) {
    if (isAvailable) {
        cast.framework.CastContext.getInstance().setOptions({
            receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
        
        document.getElementById('btn-cast').style.display = 'flex';
        
        document.getElementById('btn-cast').addEventListener('click', () => {
            const context = cast.framework.CastContext.getInstance();
            context.requestSession().then(() => {
                castSession = context.getCurrentSession();
                alert('Conectado ao Chromecast!');
            }).catch((error) => {
                console.error('Erro ao conectar Cast:', error);
            });
        });
    }
};

function castMedia(url, title, poster) {
    if (castSession) {
        const mediaInfo = new chrome.cast.media.MediaInfo(url, 'application/x-mpegurl');
        mediaInfo.metadata = new chrome.cast.media.GenericMediaMetadata();
        mediaInfo.metadata.title = title;
        if (poster) mediaInfo.metadata.images = [{ url: poster }];
        
        const request = new chrome.cast.media.LoadRequest(mediaInfo);
        castSession.loadMedia(request).then(
            () => console.log('Transmissão iniciada com sucesso'),
            (errorCode) => console.error('Erro ao iniciar transmissão', errorCode)
        );
        return true;
    }
    return false;
}

// ----------------------------------------------------
// Watch Party (Assistir com Amigos) via Firebase
// ----------------------------------------------------
class WatchParty {
    static async createParty(item) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await this.db.collection('watch_parties').doc(code).set({
            itemUrl: item.url,
            itemName: item.name,
            timestamp: 0,
            isPlaying: false,
            hostActive: true
        });

        this.currentSession = code;
        this.isHost = true;
        alert(`Sala criada! Compartilhe o código com seus amigos: ${code}`);
        Player.play(item); // Start local player
        this.startSyncing();
    }

    static async joinParty(code) {
        const doc = await this.db.collection('watch_parties').doc(code).get();
        if (doc.exists) {
            this.currentSession = code;
            this.isHost = false;
            
            const data = doc.data();
            Player.play({ name: data.itemName, url: data.itemUrl });
            
            // Listen for host changes
            this.db.collection('watch_parties').doc(code).onSnapshot((snapshot) => {
                const state = snapshot.data();
                const video = document.getElementById('video-player');
                if (video) {
                    if (state.isPlaying && video.paused) video.play();
                    if (!state.isPlaying && !video.paused) video.pause();
                    
                    if (Math.abs(video.currentTime - state.timestamp) > 2) {
                        video.currentTime = state.timestamp;
                    }
                }
            });
            alert('Você entrou na sala! Sincronizando com o host...');
        } else {
            alert('Sala não encontrada!');
        }
    }

    static startSyncing() {
        if (!this.isHost || !this.currentSession) return;
        
        const video = document.getElementById('video-player');
        
        // Sync to firebase every second
        setInterval(() => {
            if (video && !video.paused) {
                this.db.collection('watch_parties').doc(this.currentSession).update({
                    timestamp: video.currentTime,
                    isPlaying: !video.paused
                });
            }
        }, 1000);

        video.addEventListener('pause', () => {
            this.db.collection('watch_parties').doc(this.currentSession).update({ isPlaying: false });
        });
        video.addEventListener('play', () => {
            this.db.collection('watch_parties').doc(this.currentSession).update({ isPlaying: true });
        });
    }
}

WatchParty.db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
WatchParty.currentSession = null;
WatchParty.isHost = false;
