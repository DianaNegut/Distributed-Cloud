/**
 * WalletService.js - Serviciu pentru integrarea MetaMask
 * 
 * Acest serviciu gestionează:
 * - Conectarea/deconectarea wallet-ului MetaMask
 * - Obținerea balanței
 * - Trimiterea tranzacțiilor
 * - Ascultarea evenimentelor (schimbare cont/rețea)
 */

import { ethers } from 'ethers';

// Configurare rețele suportate
const SUPPORTED_NETWORKS = {
    // Filecoin Calibration Testnet
    314159: {
        chainId: '0x4cb2f',
        chainName: 'Filecoin Calibration Testnet',
        nativeCurrency: {
            name: 'Test Filecoin',
            symbol: 'tFIL',
            decimals: 18
        },
        rpcUrls: ['https://api.calibration.node.glif.io/rpc/v1'],
        blockExplorerUrls: ['https://calibration.filfox.info/']
    },
    // Sepolia Testnet (alternativă pentru teste)
    11155111: {
        chainId: '0xaa36a7',
        chainName: 'Sepolia Testnet',
        nativeCurrency: {
            name: 'Sepolia ETH',
            symbol: 'SepoliaETH',
            decimals: 18
        },
        rpcUrls: ['https://rpc.sepolia.org'],
        blockExplorerUrls: ['https://sepolia.etherscan.io/']
    },
    // Localhost (pentru dezvoltare)
    31337: {
        chainId: '0x7a69',
        chainName: 'Localhost 8545',
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['http://127.0.0.1:8545'],
        blockExplorerUrls: []
    }
};

// Rețeaua preferată (Filecoin Calibration pentru proiectul de licență)
const PREFERRED_NETWORK_ID = 314159;

class WalletService {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this.listeners = new Set();
    }

    /**
     * Verifică dacă MetaMask este instalat
     */
    isMetaMaskInstalled() {
        return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
    }

    /**
     * Conectează wallet-ul MetaMask
     * @returns {Promise<{address: string, chainId: number}>}
     */
    async connect() {
        if (!this.isMetaMaskInstalled()) {
            throw new Error('MetaMask nu este instalat! Te rog instalează extensia MetaMask.');
        }

        try {
            // Solicită permisiunea de conectare
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('Nu s-a selectat niciun cont.');
            }

            // Creează provider și signer
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.address = accounts[0];

            // Obține chain ID
            // Obține chain ID direct
            const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
            this.chainId = parseInt(chainIdHex, 16);
            console.log('[WALLET] Chain ID detectat:', this.chainId);

            // Dacă nu suntem pe rețeaua preferată (și nici pe Localhost), încercăm să schimbăm
            if (this.chainId !== PREFERRED_NETWORK_ID && this.chainId !== 31337) {
                try {
                    console.log('[WALLET] Rețea incorectă. Încercare switch...');
                    await this.switchToPreferredNetwork();
                    // Actualizăm chainId după switch
                    const newChainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
                    this.chainId = parseInt(newChainIdHex, 16);
                } catch (err) {
                    console.warn('[WALLET] Nu s-a putut schimba rețeaua:', err);
                    // Continuăm oricum, poate utilizatorul vrea așa
                }
            }

            // Setează listeners pentru evenimente
            this._setupEventListeners();

            console.log('[WALLET] Conectat:', this.address, 'pe rețeaua:', this.chainId);

            return {
                address: this.address,
                chainId: this.chainId
            };
        } catch (error) {
            console.error('[WALLET] Eroare la conectare:', error);
            throw error;
        }
    }

    /**
     * Deconectează wallet-ul (doar local, MetaMask rămâne conectat)
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chainId = null;
        this._notifyListeners({ type: 'disconnect' });
        console.log('[WALLET] Deconectat');
    }

    /**
     * Verifică dacă wallet-ul este conectat
     */
    isConnected() {
        return this.address !== null && this.provider !== null;
    }

    /**
     * Obține adresa wallet-ului conectat
     */
    getAddress() {
        return this.address;
    }

    /**
     * Obține adresa scurtată pentru afișare (0x1234...abcd)
     */
    getShortAddress() {
        if (!this.address) return null;
        return `${this.address.slice(0, 6)}...${this.address.slice(-4)}`;
    }

    /**
     * Obține balanța wallet-ului
     * @returns {Promise<{balance: string, formatted: string, symbol: string}>}
     */
    async getBalance() {
        if (!this.isConnected()) {
            throw new Error('Wallet-ul nu este conectat');
        }

        try {
            const balance = await this.provider.getBalance(this.address);
            const formatted = ethers.formatEther(balance);

            // Determină simbolul monedei bazat pe rețea
            const network = SUPPORTED_NETWORKS[this.chainId];
            const symbol = network?.nativeCurrency?.symbol || 'ETH';

            return {
                balance: balance.toString(),
                formatted: parseFloat(formatted).toFixed(4),
                symbol: symbol
            };
        } catch (error) {
            console.error('[WALLET] Eroare la obținere balanță:', error);
            throw error;
        }
    }

    /**
     * Trimite o plată
     * @param {string} toAddress - Adresa destinatarului
     * @param {string|number} amount - Suma în ETH/tFIL
     * @returns {Promise<{hash: string, receipt: object}>}
     */
    async sendPayment(toAddress, amount) {
        if (!this.isConnected()) {
            throw new Error('Wallet-ul nu este conectat');
        }

        try {
            console.log(`[WALLET] Trimitere ${amount} către ${toAddress}...`);

            // Convertește suma în wei
            const value = ethers.parseEther(amount.toString());

            // Creează și trimite tranzacția
            const tx = await this.signer.sendTransaction({
                to: toAddress,
                value: value
            });

            console.log('[WALLET] Tranzacție trimisă:', tx.hash);

            // Așteaptă confirmarea
            const receipt = await tx.wait();
            console.log('[WALLET] Tranzacție confirmată în blocul:', receipt.blockNumber);

            return {
                hash: tx.hash,
                receipt: receipt
            };
        } catch (error) {
            console.error('[WALLET] Eroare la trimitere plată:', error);

            // Gestionează erori specifice
            if (error.code === 'ACTION_REJECTED') {
                throw new Error('Tranzacția a fost respinsă de utilizator');
            }
            if (error.code === 'INSUFFICIENT_FUNDS') {
                throw new Error('Fonduri insuficiente pentru această tranzacție');
            }

            throw error;
        }
    }

    /**
     * Plătește un contract de stocare
     * @param {string} contractId - ID-ul contractului
     * @param {string|number} amount - Suma de plătit
     * @param {string} providerAddress - Adresa providerului (opțional)
     * @returns {Promise<{hash: string, contractId: string}>}
     */
    async payStorageContract(contractId, amount, providerAddress = null) {
        // Dacă nu avem adresa providerului, folosim o adresă placeholder
        // În producție, aceasta ar trebui să fie adresa smart contract-ului
        const recipient = providerAddress || '0x0000000000000000000000000000000000000001';

        try {
            const result = await this.sendPayment(recipient, amount);

            return {
                hash: result.hash,
                contractId: contractId,
                amount: amount,
                recipient: recipient
            };
        } catch (error) {
            console.error('[WALLET] Eroare la plata contractului:', error);
            throw error;
        }
    }

    /**
     * Schimbă rețeaua la cea preferată
     */
    async switchToPreferredNetwork() {
        const network = SUPPORTED_NETWORKS[PREFERRED_NETWORK_ID];
        if (!network) {
            throw new Error('Rețeaua preferată nu este configurată');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: network.chainId }]
            });
        } catch (error) {
            // Dacă rețeaua nu există, o adăugăm
            if (error.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [network]
                });
            } else {
                throw error;
            }
        }
    }

    /**
     * Obține informații despre rețeaua curentă
     */
    getNetworkInfo() {
        if (!this.chainId) return null;

        const network = SUPPORTED_NETWORKS[this.chainId];
        return {
            chainId: this.chainId,
            name: network?.chainName || `Unknown (${this.chainId})`,
            symbol: network?.nativeCurrency?.symbol || 'ETH',
            isSupported: !!network
        };
    }

    /**
     * Adaugă un listener pentru evenimente wallet
     */
    addListener(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Notifică toți listeners despre un eveniment
     */
    _notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('[WALLET] Eroare în listener:', error);
            }
        });
    }

    /**
     * Configurează listeners pentru evenimente MetaMask
     */
    _setupEventListeners() {
        if (!window.ethereum) return;

        // Schimbare cont
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
                this.disconnect();
            } else {
                this.address = accounts[0];
                this.signer = await this.provider.getSigner();
                this._notifyListeners({ type: 'accountChanged', address: this.address });
                console.log('[WALLET] Cont schimbat:', this.address);
            }
        });

        // Schimbare rețea
        window.ethereum.on('chainChanged', (chainId) => {
            this.chainId = parseInt(chainId, 16);
            this._notifyListeners({ type: 'chainChanged', chainId: this.chainId });
            console.log('[WALLET] Rețea schimbată:', this.chainId);
            // Reîncarcă pagina pentru a evita probleme de stare
            window.location.reload();
        });

        // Deconectare
        window.ethereum.on('disconnect', () => {
            this.disconnect();
        });
    }

    /**
     * Semnează un mesaj (pentru autentificare)
     */
    async signMessage(message) {
        if (!this.isConnected()) {
            throw new Error('Wallet-ul nu este conectat');
        }

        try {
            const signature = await this.signer.signMessage(message);
            return signature;
        } catch (error) {
            if (error.code === 'ACTION_REJECTED') {
                throw new Error('Semnătura a fost respinsă de utilizator');
            }
            throw error;
        }
    }
}

// Export instanță singleton
const walletService = new WalletService();
export default walletService;

// Export și clasa pentru testing
export { WalletService, SUPPORTED_NETWORKS, PREFERRED_NETWORK_ID };
