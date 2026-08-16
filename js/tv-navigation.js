/**
 * TV Spatial Navigation System
 * Handles D-pad navigation (Up, Down, Left, Right, Enter, Back) for Android TV and Fire TV.
 */

class TVNavigation {
    constructor() {
        this.focusableSelector = 'a, button, input, [tabindex="0"], .card, .nav-item';
        this.currentFocus = null;
        this.isActive = false; // Activates only when an arrow key is pressed

        this.init();
    }

    init() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Listen to native focus changes to sync our state if someone clicks
        document.addEventListener('focusin', (e) => {
            if (this.isActive && e.target.matches(this.focusableSelector)) {
                this.setFocus(e.target);
            }
        });
    }

    handleKeyDown(e) {
        // D-pad keys
        const KEY_UP = 38;
        const KEY_DOWN = 40;
        const KEY_LEFT = 37;
        const KEY_RIGHT = 39;
        const KEY_ENTER = 13;
        const KEY_BACK = 27; // Escape acts as back in web, Android usually maps back button to Escape or physical back
        const KEY_BACK_ANDROID = 10009; // Some TVs send specific codes for Back
        const KEY_BACK_WEBOS = 461; // LG webOS Back button

        const isDirectional = [KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT].includes(e.keyCode);

        if ((isDirectional || e.keyCode === KEY_ENTER) && !this.isActive) {
            this.isActive = true;
            document.body.classList.add('tv-mode'); // Helps CSS know we are using D-pad
            
            // If nothing is focused, focus the first item
            if (!this.currentFocus || !document.contains(this.currentFocus)) {
                const first = document.querySelector(this.focusableSelector);
                if (first) this.setFocus(first);
                e.preventDefault();
                return;
            }
        }

        if (!this.isActive) return;

        if (isDirectional) {
            e.preventDefault();
            this.navigate(e.keyCode);
        } else if (e.keyCode === KEY_ENTER) {
            // Force native click to ensure webOS triggers the action properly
            if (this.currentFocus && document.contains(this.currentFocus)) {
                e.preventDefault();
                this.currentFocus.click();
            }
        } else if (e.keyCode === KEY_BACK || e.keyCode === KEY_BACK_ANDROID || e.keyCode === KEY_BACK_WEBOS) {
            // Handle Back Button
            e.preventDefault();
            this.handleBack();
        }
    }

    navigate(direction) {
        if (!this.currentFocus || !document.contains(this.currentFocus)) {
            const first = document.querySelector(this.focusableSelector);
            if (first) this.setFocus(first);
            return;
        }

        const focusableElements = Array.from(document.querySelectorAll(this.focusableSelector))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                // Must be visible
                return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
            });

        const currentRect = this.currentFocus.getBoundingClientRect();
        let bestMatch = null;
        let minDistance = Infinity;

        focusableElements.forEach(el => {
            if (el === this.currentFocus) return;

            const rect = el.getBoundingClientRect();
            
            // Calculate center points
            const currentCenter = {
                x: currentRect.left + currentRect.width / 2,
                y: currentRect.top + currentRect.height / 2
            };
            const elCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            let isValidDirection = false;
            let primaryDistance = 0;
            let secondaryDistance = 0;

            if (direction === 37) { // LEFT
                isValidDirection = elCenter.x < currentCenter.x;
                primaryDistance = currentCenter.x - elCenter.x;
                secondaryDistance = Math.abs(currentCenter.y - elCenter.y);
            } else if (direction === 39) { // RIGHT
                isValidDirection = elCenter.x > currentCenter.x;
                primaryDistance = elCenter.x - currentCenter.x;
                secondaryDistance = Math.abs(currentCenter.y - elCenter.y);
            } else if (direction === 38) { // UP
                isValidDirection = elCenter.y < currentCenter.y;
                primaryDistance = currentCenter.y - elCenter.y;
                secondaryDistance = Math.abs(currentCenter.x - elCenter.x);
            } else if (direction === 40) { // DOWN
                isValidDirection = elCenter.y > currentCenter.y;
                primaryDistance = elCenter.y - currentCenter.y;
                secondaryDistance = Math.abs(currentCenter.x - elCenter.x);
            }

            if (isValidDirection) {
                // Weight the primary distance more heavily to ensure straight lines
                const distance = primaryDistance + (secondaryDistance * 2);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestMatch = el;
                }
            }
        });

        if (bestMatch) {
            this.setFocus(bestMatch);
        }
    }

    setFocus(element) {
        if (this.currentFocus) {
            this.currentFocus.classList.remove('tv-focused');
        }
        
        this.currentFocus = element;
        this.currentFocus.classList.add('tv-focused');
        this.currentFocus.focus();

        // Smooth scroll to keep element in center
        this.currentFocus.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    handleBack() {
        // If player is open, close it
        const playerOverlay = document.getElementById('player-overlay');
        if (playerOverlay && playerOverlay.style.display !== 'none') {
            document.getElementById('btn-close-player').click();
            return;
        }

        // If detail overlay is open, close it
        const detailOverlay = document.getElementById('detail-overlay');
        if (detailOverlay && detailOverlay.classList.contains('active')) {
            document.getElementById('btn-close-detail').click();
            return;
        }

        // If modal is open, close it
        const modals = document.querySelectorAll('.modal-overlay.active');
        if (modals.length > 0) {
            modals[0].classList.remove('active');
            return;
        }

        // Otherwise go to home
        const homeBtn = document.querySelector('.nav-item[data-view="home"]');
        if (homeBtn && this.currentFocus !== homeBtn) {
            homeBtn.click();
            this.setFocus(homeBtn);
        } else {
            // Se já estiver na Home e pressionar back, solicita saída graciosamente no webOS
            if (window.webOS && window.webOS.platformBack) {
                window.webOS.platformBack();
            }
        }
    }
}

// Initialize on load
window.addEventListener('load', () => {
    window.tvNavigation = new TVNavigation();
});
