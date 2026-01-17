/**
 * WalletContext.jsx - Context React pentru gestionarea stării wallet-ului
 * 
 * Oferă acces la funcționalitățile MetaMask în toată aplicația:
 * - Starea conexiunii
 * - Adresa și balanța wallet-ului
 * - Funcții pentru conectare/deconectare
 * - Funcții pentru plăți
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import walletService from '../services/WalletService';

// Creează context-ul
const WalletContext = createContext(null);

// Provider component
export function WalletProvider({ children }) {
    // State pentru wallet
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [address, setAddress] = useState(null);
    const [shortAddress, setShortAddress] = useState(null);
    const [balance, setBalance] = useState(null);
    const [networkInfo, setNetworkInfo] = useState(null);
    const [error, setError] = useState(null);

    // Actualizează balanța
    const refreshBalance = useCallback(async () => {
        if (!walletService.isConnected()) return;

        try {
            const balanceInfo = await walletService.getBalance();
            setBalance(balanceInfo);
        } catch (err) {
            console.error('[WALLET-CONTEXT] Eroare la actualizare balanță:', err);
        }
    }, []);

    // Conectare wallet
    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);

        try {
            const result = await walletService.connect();

            setAddress(result.address);
            setShortAddress(walletService.getShortAddress());
            setNetworkInfo(walletService.getNetworkInfo());
            setIsConnected(true);

            // Obține balanța
            await refreshBalance();

            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setIsConnecting(false);
        }
    }, [refreshBalance]);

    // Deconectare wallet
    const disconnect = useCallback(() => {
        walletService.disconnect();
        setIsConnected(false);
        setAddress(null);
        setShortAddress(null);
        setBalance(null);
        setNetworkInfo(null);
        setError(null);
    }, []);

    // Plătește un contract de stocare
    const payContract = useCallback(async (contractId, amount, providerAddress = null) => {
        if (!isConnected) {
            throw new Error('Te rog conectează wallet-ul mai întâi');
        }

        try {
            const result = await walletService.payStorageContract(
                contractId,
                amount,
                providerAddress
            );

            // Actualizează balanța după plată
            await refreshBalance();

            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [isConnected, refreshBalance]);

    // Trimite plată generală
    const sendPayment = useCallback(async (toAddress, amount) => {
        if (!isConnected) {
            throw new Error('Te rog conectează wallet-ul mai întâi');
        }

        try {
            const result = await walletService.sendPayment(toAddress, amount);
            await refreshBalance();
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [isConnected, refreshBalance]);

    // Semnează mesaj
    const signMessage = useCallback(async (message) => {
        if (!isConnected) {
            throw new Error('Te rog conectează wallet-ul mai întâi');
        }

        try {
            return await walletService.signMessage(message);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [isConnected]);

    // Schimbă la rețeaua preferată
    const switchNetwork = useCallback(async () => {
        try {
            await walletService.switchToPreferredNetwork();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    // Listener pentru evenimente wallet
    useEffect(() => {
        const handleWalletEvent = async (event) => {
            switch (event.type) {
                case 'accountChanged':
                    setAddress(event.address);
                    setShortAddress(walletService.getShortAddress());
                    await refreshBalance();
                    break;
                case 'chainChanged':
                    setNetworkInfo(walletService.getNetworkInfo());
                    await refreshBalance();
                    break;
                case 'disconnect':
                    // Update local state directly to avoid infinite loop
                    setIsConnected(false);
                    setAddress(null);
                    setShortAddress(null);
                    setBalance(null);
                    setNetworkInfo(null);
                    setError(null);
                    break;
                default:
                    break;
            }
        };

        const removeListener = walletService.addListener(handleWalletEvent);
        return () => removeListener();
    }, [disconnect, refreshBalance]);

    // Verifică dacă MetaMask este instalat
    const isMetaMaskInstalled = walletService.isMetaMaskInstalled();

    // Valoarea context-ului
    const value = {
        // State
        isMetaMaskInstalled,
        isConnected,
        isConnecting,
        address,
        shortAddress,
        balance,
        networkInfo,
        error,

        // Actions
        connect,
        disconnect,
        payContract,
        sendPayment,
        signMessage,
        switchNetwork,
        refreshBalance,
        clearError: () => setError(null)
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

// Hook pentru utilizare ușoară
export function useWallet() {
    const context = useContext(WalletContext);

    if (!context) {
        throw new Error('useWallet trebuie folosit în interiorul unui WalletProvider');
    }

    return context;
}

// Export default
export default WalletContext;
