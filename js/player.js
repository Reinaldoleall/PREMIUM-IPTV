class PlayerManager {
    constructor() {
        this.videoElement = document.getElementById('video-player');
        this.overlay = document.getElementById('player-overlay');
        this.titleElement = document.getElementById('player-title');
        this.closeBtn = document.getElementById('btn-close-player');
        this.shakaPlayer = null;
        
        this.closeBtn.addEventListener('click', () => this.stop());

        // Install built-in polyfills to patch browser incompatibilities.
        if (typeof shaka !== 'undefined') {
            shaka.polyfill.installAll();
            if (shaka.Player.isBrowserSupported()) {
                this.shakaPlayer = new shaka.Player(this.videoElement);
                this.shakaPlayer.addEventListener('error', this.onErrorEvent);
            } else {
                console.error('Browser not supported by Shaka Player!');
            }
        }
    }

    onErrorEvent(event) {
        console.error('Shaka Player Error:', event.detail);
    }

    async play(item) {
        this.titleElement.textContent = item.name;
        this.overlay.style.display = 'flex';
        
        const url = item.url;
        
        if (this.shakaPlayer) {
            try {
                await this.shakaPlayer.load(url);
                this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
            } catch (e) {
                console.error("Shaka Player Error loading video:", e);
                // Fallback to native
                this.videoElement.src = url;
                this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
            }
        } else {
            // Standard MP4/MKV fallback or Safari native HLS
            this.videoElement.src = url;
            this.videoElement.play().catch(e => console.error("Auto-play prevented", e));
        }

        // Add to history
        DB.addToHistory(item);
    }

    async stop() {
        if (this.shakaPlayer) {
            await this.shakaPlayer.unload();
        }
        this.videoElement.pause();
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
        this.overlay.style.display = 'none';
    }
}

const Player = new PlayerManager();
