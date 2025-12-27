/**
 * Storage Reservation Manager
 * Gestionează rezervarea fizică a spațiului de stocare pentru provideri
 * - Verifică spațiul liber pe disc
 * - Creează foldere dedicate pentru fiecare provider
 * - Ține evidența spațiului alocat total
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { IPFS_PATH } = require('../config/paths');

const RESERVATIONS_FILE = path.join(IPFS_PATH, 'storage-reservations.json');
const PROVIDER_STORAGE_BASE = path.join(IPFS_PATH, 'provider-storage');

class StorageReservationManager {
    constructor() {
        this.reservations = this.loadReservations();
        this.ensureStorageDirectory();
    }

    /**
     * Încarcă rezervările din fișier
     */
    loadReservations() {
        try {
            if (fs.existsSync(RESERVATIONS_FILE)) {
                const data = JSON.parse(fs.readFileSync(RESERVATIONS_FILE, 'utf8'));
                console.log(`[STORAGE-RESERVATION] Loaded ${Object.keys(data.providers || {}).length} provider reservations`);
                return data;
            }
        } catch (error) {
            console.error('[STORAGE-RESERVATION] Error loading reservations:', error.message);
        }
        return {
            providers: {},
            totalAllocatedGB: 0,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Salvează rezervările pe disc
     */
    saveReservations() {
        try {
            this.reservations.lastUpdated = new Date().toISOString();
            fs.writeFileSync(RESERVATIONS_FILE, JSON.stringify(this.reservations, null, 2));
        } catch (error) {
            console.error('[STORAGE-RESERVATION] Error saving reservations:', error.message);
        }
    }

    /**
     * Asigură existența directorului de stocare
     */
    ensureStorageDirectory() {
        if (!fs.existsSync(PROVIDER_STORAGE_BASE)) {
            fs.mkdirSync(PROVIDER_STORAGE_BASE, { recursive: true });
            console.log(`[STORAGE-RESERVATION] Created provider storage directory: ${PROVIDER_STORAGE_BASE}`);
        }
    }

    /**
     * Obține spațiul liber pe disc (cross-platform)
     * @returns {Object} { freeBytes, freeGB, totalBytes, totalGB, usedPercent }
     */
    getDiskSpace() {
        try {
            const isWindows = process.platform === 'win32';

            if (isWindows) {
                // Windows: folosim PowerShell (compatibil cu Windows 10/11)
                const drive = IPFS_PATH.split(':')[0];
                const psCommand = `powershell -Command "(Get-PSDrive -Name '${drive}' | Select-Object -Property Free,Used | ConvertTo-Json)"`;

                const output = execSync(psCommand, { encoding: 'utf8' });
                const driveInfo = JSON.parse(output.trim());

                const freeBytes = driveInfo.Free || 0;
                const usedBytes = driveInfo.Used || 0;
                const totalBytes = freeBytes + usedBytes;

                return {
                    freeBytes,
                    freeGB: parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2)),
                    totalBytes,
                    totalGB: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
                    usedPercent: totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0
                };
            } else {
                // Linux/Mac: folosim df
                const output = execSync(`df -B1 "${IPFS_PATH}"`, { encoding: 'utf8' });
                const lines = output.trim().split('\n');
                const parts = lines[1].split(/\s+/);

                const totalBytes = parseInt(parts[1]) || 0;
                const usedBytes = parseInt(parts[2]) || 0;
                const freeBytes = parseInt(parts[3]) || 0;

                return {
                    freeBytes,
                    freeGB: parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2)),
                    totalBytes,
                    totalGB: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
                    usedPercent: parseFloat(((usedBytes / totalBytes) * 100).toFixed(1))
                };
            }
        } catch (error) {
            console.error('[STORAGE-RESERVATION] Error getting disk space:', error.message);
            return {
                freeBytes: 0,
                freeGB: 0,
                totalBytes: 0,
                totalGB: 0,
                usedPercent: 0,
                error: error.message
            };
        }
    }

    /**
     * Obține spațiul total alocat tuturor providerilor
     * @returns {number} Total GB alocat
     */
    getTotalAllocated() {
        return Object.values(this.reservations.providers || {})
            .reduce((sum, p) => sum + (p.allocatedGB || 0), 0);
    }

    /**
     * Obține spațiul disponibil pentru noi alocări
     * @returns {Object} { availableGB, diskFreeGB, totalAllocatedGB }
     */
    getAvailableSpace() {
        const diskSpace = this.getDiskSpace();
        const totalAllocated = this.getTotalAllocated();

        // Spațiul disponibil = spațiu liber pe disc - ce e deja alocat altor provideri
        // Păstrăm un buffer de 5GB pentru sistem
        const systemReserve = 5;
        const availableGB = Math.max(0, diskSpace.freeGB - totalAllocated - systemReserve);

        return {
            availableGB: parseFloat(availableGB.toFixed(2)),
            diskFreeGB: diskSpace.freeGB,
            totalAllocatedGB: totalAllocated,
            systemReserveGB: systemReserve
        };
    }

    /**
     * Verifică dacă o alocare este posibilă
     * @param {number} requestedGB - GB dorit
     * @returns {Object} { success, error, availableGB }
     */
    canAllocate(requestedGB) {
        const available = this.getAvailableSpace();

        if (requestedGB <= 0) {
            return {
                success: false,
                error: 'Capacitatea trebuie să fie mai mare de 0 GB',
                availableGB: available.availableGB
            };
        }

        if (requestedGB > available.availableGB) {
            return {
                success: false,
                error: `Spațiu insuficient! Disponibil: ${available.availableGB} GB, Cerut: ${requestedGB} GB. ` +
                    `(Disc liber: ${available.diskFreeGB} GB, Deja alocat: ${available.totalAllocatedGB} GB)`,
                availableGB: available.availableGB,
                diskFreeGB: available.diskFreeGB,
                totalAllocatedGB: available.totalAllocatedGB
            };
        }

        return {
            success: true,
            availableGB: available.availableGB,
            afterAllocationGB: parseFloat((available.availableGB - requestedGB).toFixed(2))
        };
    }

    /**
     * Creează folderul dedicat pentru un provider
     * @param {string} providerId - ID-ul providerului
     * @returns {string} Calea către folder
     */
    createProviderFolder(providerId) {
        const folderPath = path.join(PROVIDER_STORAGE_BASE, providerId);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
            console.log(`[STORAGE-RESERVATION] Created folder for provider ${providerId}: ${folderPath}`);
        }

        return folderPath;
    }

    /**
     * Înregistrează o rezervare de stocare pentru un provider
     * @param {string} providerId - ID-ul providerului
     * @param {number} allocatedGB - GB alocat
     * @param {string} peerId - Owner username
     * @returns {Object} Rezervarea creată
     */
    registerAllocation(providerId, allocatedGB, peerId) {
        // Verifică dacă alocarea este posibilă
        const canAlloc = this.canAllocate(allocatedGB);
        if (!canAlloc.success) {
            throw new Error(canAlloc.error);
        }

        // Creează folderul
        const storagePath = this.createProviderFolder(providerId);

        // Înregistrează rezervarea
        const reservation = {
            providerId,
            peerId,
            allocatedGB,
            usedGB: 0,
            storagePath,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.reservations.providers[providerId] = reservation;
        this.reservations.totalAllocatedGB = this.getTotalAllocated();
        this.saveReservations();

        console.log(`[STORAGE-RESERVATION] Registered allocation: ${allocatedGB} GB for provider ${providerId}`);

        return reservation;
    }

    /**
     * Actualizează spațiul folosit de un provider
     * @param {string} providerId - ID-ul providerului
     * @param {number} usedGB - GB folosit efectiv
     */
    updateUsedSpace(providerId, usedGB) {
        if (this.reservations.providers[providerId]) {
            this.reservations.providers[providerId].usedGB = usedGB;
            this.reservations.providers[providerId].updatedAt = new Date().toISOString();
            this.saveReservations();
        }
    }

    /**
     * Calculează spațiul folosit real dintr-un folder
     * @param {string} providerId - ID-ul providerului
     * @returns {number} GB folosit
     */
    calculateActualUsage(providerId) {
        const reservation = this.reservations.providers[providerId];
        if (!reservation || !reservation.storagePath) return 0;

        try {
            let totalBytes = 0;
            const files = fs.readdirSync(reservation.storagePath);

            for (const file of files) {
                const filePath = path.join(reservation.storagePath, file);
                const stats = fs.statSync(filePath);
                totalBytes += stats.size;
            }

            return parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(4));
        } catch (error) {
            return 0;
        }
    }

    /**
     * Obține calea de stocare pentru un provider
     * @param {string} providerId - ID-ul providerului
     * @returns {string|null} Calea sau null
     */
    getProviderStoragePath(providerId) {
        return this.reservations.providers[providerId]?.storagePath || null;
    }

    /**
     * Obține rezervarea unui provider
     * @param {string} providerId - ID-ul providerului
     * @returns {Object|null} Rezervarea sau null
     */
    getProviderReservation(providerId) {
        return this.reservations.providers[providerId] || null;
    }

    /**
     * Șterge rezervarea unui provider
     * @param {string} providerId - ID-ul providerului
     */
    removeAllocation(providerId) {
        if (this.reservations.providers[providerId]) {
            const storagePath = this.reservations.providers[providerId].storagePath;

            // Opțional: șterge folderul (doar dacă e gol)
            try {
                if (storagePath && fs.existsSync(storagePath)) {
                    const files = fs.readdirSync(storagePath);
                    if (files.length === 0) {
                        fs.rmdirSync(storagePath);
                        console.log(`[STORAGE-RESERVATION] Removed empty folder: ${storagePath}`);
                    } else {
                        console.log(`[STORAGE-RESERVATION] Folder not empty, keeping: ${storagePath}`);
                    }
                }
            } catch (error) {
                console.error(`[STORAGE-RESERVATION] Error removing folder:`, error.message);
            }

            delete this.reservations.providers[providerId];
            this.reservations.totalAllocatedGB = this.getTotalAllocated();
            this.saveReservations();

            console.log(`[STORAGE-RESERVATION] Removed allocation for provider ${providerId}`);
        }
    }

    /**
     * Statistici generale
     */
    getStatistics() {
        const diskSpace = this.getDiskSpace();
        const totalAllocated = this.getTotalAllocated();
        const providers = Object.values(this.reservations.providers || {});

        return {
            disk: {
                totalGB: diskSpace.totalGB,
                freeGB: diskSpace.freeGB,
                usedPercent: diskSpace.usedPercent
            },
            allocations: {
                totalProviders: providers.length,
                totalAllocatedGB: totalAllocated,
                totalUsedGB: providers.reduce((sum, p) => sum + (p.usedGB || 0), 0),
                availableForNewProvidersGB: this.getAvailableSpace().availableGB
            },
            providers: providers.map(p => ({
                providerId: p.providerId,
                peerId: p.peerId,
                allocatedGB: p.allocatedGB,
                usedGB: p.usedGB,
                usagePercent: p.allocatedGB > 0 ? parseFloat(((p.usedGB / p.allocatedGB) * 100).toFixed(1)) : 0
            }))
        };
    }
}

// Singleton instance
module.exports = new StorageReservationManager();
