class PlayerManager {
    constructor() {
        this.videoContainer = document.getElementById('video-container');
        this.videoElement = document.getElementById('video-player');
        this.overlay = document.getElementById('player-overlay');
        this.titleElement = document.getElementById('player-title');
        this.closeBtn = document.getElementById('btn-close-player');
        this.shakaPlayer = null;
        this.uiOverlay = null;
        
        this.closeBtn.addEventListener('click', () => this.stop());

        // Install built-in polyfills to patch browser incompatibilities.
        if (typeof shaka !== 'undefined') {
            shaka.polyfill.installAll();
            if (shaka.Player.isBrowserSupported()) {
                this.initShaka();
            } else {
                console.error('Browser not supported by Shaka Player!');
                this.videoElement.setAttribute('controls', 'true');
            }
        } else {
            this.videoElement.setAttribute('controls', 'true');
        }
    }

    async initShaka() {
        this.shakaPlayer = new shaka.Player(this.videoElement);
        this.shakaPlayer.addEventListener('error', this.onErrorEvent);

        this.uiOverlay = new shaka.ui.Overlay(
            this.shakaPlayer,
            this.videoContainer,
            this.videoElement
        );

        const config = {
            controlPanelElements: [
                'play_pause', 'time_and_duration', 'spacer', 'mute', 'volume',
                'captions', 'language', 'quality', 'picture_in_picture', 'fullscreen'
            ]
        };
        this.uiOverlay.configure(config);
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
