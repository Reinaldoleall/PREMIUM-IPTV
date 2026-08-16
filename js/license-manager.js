class LicenseManager {
    // Generate or retrieve a persistent UUID for this browser to act as Android ID
    static async getDeviceId() {
        let deviceId = await localforage.getItem('IPTV_DEVICE_ID');
        if (!deviceId) {
            deviceId = 'web-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            await localforage.setItem('IPTV_DEVICE_ID', deviceId);
        }
        return deviceId;
    }

    static async getDeviceName() {
        return `Navegador Web (${navigator.platform})`;
    }

    static async getSavedLicense() {
        return await localforage.getItem('IPTV_SAVED_LICENSE');
    }

    static async saveCache(licenseKey, expiresMs, plan) {
        await localforage.setItem('IPTV_SAVED_LICENSE', licenseKey);
        await localforage.setItem('IPTV_LICENSE_EXPIRES', expiresMs);
        await localforage.setItem('IPTV_LICENSE_PLAN', plan);
        await localforage.setItem('IPTV_LAST_VALIDATION', Date.now());
    }

    static async isOfflineAllowed() {
        const lastValidation = await localforage.getItem('IPTV_LAST_VALIDATION') || 0;
        const expires = await localforage.getItem('IPTV_LICENSE_EXPIRES') || 0;

        if (expires < Date.now()) return false;
        if ((Date.now() - lastValidation) < this.OFFLINE_CACHE_DURATION_MS) {
            return true;
        }
        return false;
    }

    static async validateLicense(licenseKey, force = false) {
        if (!licenseKey || licenseKey.trim() === '') {
            throw new Error("Chave de licença inválida.");
        }

        try {
            const docRef = this.db.collection("licenses").doc(licenseKey);
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                const active = data.active;
                const expiresTimestamp = data.expires;

                if (active && expiresTimestamp) {
                    const expiresMs = expiresTimestamp.toDate().getTime();
                    if (expiresMs > Date.now()) {
                        const plan = data.plan || "Desconhecido";
                        const maxDevices = data.maxDevices || 1;
                        const activeDevices = data.activeDevices || {};
                        const deviceId = await this.getDeviceId();
                        const deviceName = await this.getDeviceName();

                        if (activeDevices[deviceId]) {
                            // Already registered
                            await this.saveCache(licenseKey, expiresMs, plan);
                            this.logValidation(licenseKey, "SUCCESS");
                            return true;
                        } else {
                            // Needs to register
                            const currentDevicesCount = Object.keys(activeDevices).length;
                            
                            if (currentDevicesCount >= maxDevices) {
                                if (force) {
                                    // Remove oldest device
                                    const keys = Object.keys(activeDevices);
                                    if (keys.length > 0) {
                                        delete activeDevices[keys[0]];
                                    }
                                    activeDevices[deviceId] = deviceName;
                                    await docRef.update({ activeDevices: activeDevices });
                                    await this.saveCache(licenseKey, expiresMs, plan);
                                    this.logValidation(licenseKey, "SUCCESS_FORCED");
                                    return true;
                                } else {
                                    this.logValidation(licenseKey, "DEVICE_LIMIT");
                                    const err = new Error("Limite de telas atingido.");
                                    err.code = "DEVICE_LIMIT";
                                    err.activeDevices = activeDevices;
                                    throw err;
                                }
                            } else {
                                // Has space
                                activeDevices[deviceId] = deviceName;
                                await docRef.update({ activeDevices: activeDevices });
                                await this.saveCache(licenseKey, expiresMs, plan);
                                this.logValidation(licenseKey, "SUCCESS");
                                return true;
                            }
                        }
                    } else {
                        this.logValidation(licenseKey, "EXPIRED");
                        throw new Error("Sua licença expirou.");
                    }
                } else {
                    this.logValidation(licenseKey, "INVALID");
                    throw new Error("Sua licença foi bloqueada ou é inválida.");
                }
            } else {
                this.logValidation(licenseKey, "NOT_FOUND");
                throw new Error("Licença não encontrada.");
            }
        } catch (e) {
            if (e.code === "DEVICE_LIMIT") throw e;
            
            // Network failure fallback
            if (await this.isOfflineAllowed()) {
                console.warn("Validação falhou. Usando Token Temporário Offline válido.");
                this.logValidation(licenseKey, "OFFLINE_SUCCESS");
                return true;
            } else {
                throw new Error(e.message || "Erro de conexão persistente. Seu token offline expirou.");
            }
        }
    }

    static async logout() {
        await localforage.removeItem('IPTV_SAVED_LICENSE');
        await localforage.removeItem('IPTV_LICENSE_EXPIRES');
        await localforage.removeItem('IPTV_LICENSE_PLAN');
        await localforage.removeItem('IPTV_LAST_VALIDATION');
    }

    static async logValidation(licenseKey, result) {
        try {
            const deviceId = await this.getDeviceId();
            await this.db.collection("logs").add({
                licenseKey: licenseKey,
                androidId: deviceId, // simulating androidId
                result: result,
                model: navigator.userAgent,
                manufacturer: "Web",
                androidVersion: navigator.platform,
                date: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao salvar log de validação", e);
        }
    }
}

LicenseManager.db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
LicenseManager.OFFLINE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
