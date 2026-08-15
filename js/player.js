class PlayerManager {
    constructor() {
        this.videoElement = document.getElementById('video-player');
        this.overlay = document.getElementById('player-overlay');
        this.titleElement = document.getElementById('player-title');
        this.closeBtn = document.getElementById('btn-close-player');
        this.hls = null;
        
        this.closeBtn.addEventListener('click', () => this.stop());
    }

    play(item) {
        this.titleElement.textContent = item.name;
        this.overlay.style.display = 'flex';
        
        const url = item.url;
        
        if (Hls.isSupported() && url.includes('.m3u8')) {
            if (this.hls) {
                this.hls.destroy();
            }
            this.hls = new Hls();
            this.hls.loadSource(url);
            this.hls.attachMedia(this.videoElement);
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
            });
        } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl') && url.includes('.m3u8')) {
            // Safari support
            this.videoElement.src = url;
            this.videoElement.addEventListener('loadedmetadata', () => {
                this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
            });
        } else {
            // Standard MP4/MKV fallback
            this.videoElement.src = url;
            this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
        }

        // Add to history
        DB.addToHistory(item);
    }

    stop() {
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
        this.overlay.style.display = 'none';
    }
}

const Player = new PlayerManager();
