class ProfileManager {
    static async getProfiles() {
        let profiles = await localforage.getItem('IPTV_PROFILES');
        if (!profiles) {
            profiles = [
                { id: '1', name: 'Principal', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Principal', isKids: false },
                { id: '2', name: 'Kids', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kids', isKids: true }
            ];
            await localforage.setItem('IPTV_PROFILES', profiles);
        }
        return profiles;
    }

    static async getActiveProfile() {
        return await localforage.getItem('IPTV_ACTIVE_PROFILE') || null;
    }

    static async setActiveProfile(profile) {
        await localforage.setItem('IPTV_ACTIVE_PROFILE', profile);
        // Prefix DB stores with profile ID
        DB.setProfileContext(profile.id);
    }
}

class ParentalControl {
    
    static async hasPin() {
        const pin = await localforage.getItem(this.PIN_KEY);
        return !!pin;
    }

    static async verifyPin(enteredPin) {
        const pin = await localforage.getItem(this.PIN_KEY);
        return pin === enteredPin;
    }

    static async setPin(newPin) {
        await localforage.setItem(this.PIN_KEY, newPin);
    }

    static isAdultContent(groupName) {
        if (!groupName) return false;
        const lower = groupName.toLowerCase();
        return lower.includes('+18') || lower.includes('adult') || lower.includes('xxx') || lower.includes('porn');
    }
}

ParentalControl.PIN_KEY = 'IPTV_PARENTAL_PIN';
