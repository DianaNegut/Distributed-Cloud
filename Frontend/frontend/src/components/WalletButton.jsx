/**
 * WalletButton.jsx - Componentă pentru conectarea/afișarea wallet-ului MetaMask
 * 
 * Afișează:
 * - Buton "Connect Wallet" când nu e conectat
 * - Adresa și balanța când e conectat
 * - Dropdown cu opțiuni (deconectare, etc.)
 */

import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import './WalletButton.css';

function WalletButton() {
    const {
        isMetaMaskInstalled,
        isConnected,
        isConnecting,
        shortAddress,
        balance,
        networkInfo,
        error,
        connect,
        disconnect,
        clearError
    } = useWallet();

    const [showDropdown, setShowDropdown] = useState(false);

    // Handler pentru click pe buton
    const handleClick = async () => {
        if (!isConnected) {
            try {
                await connect();
            } catch (err) {
                console.error('Eroare la conectare:', err);
            }
        } else {
            setShowDropdown(!showDropdown);
        }
    };

    // Dacă MetaMask nu e instalat
    if (!isMetaMaskInstalled) {
        return (
            <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="wallet-button wallet-install"
            >
                <span className="wallet-icon">🦊</span>
                Instalează MetaMask
            </a>
        );
    }

    // Dacă se conectează
    if (isConnecting) {
        return (
            <button className="wallet-button wallet-connecting" disabled>
                <span className="wallet-spinner"></span>
                Se conectează...
            </button>
        );
    }

    // Dacă e conectat
    if (isConnected) {
        return (
            <div className="wallet-container">
                <button
                    className="wallet-button wallet-connected"
                    onClick={handleClick}
                >
                    {/* Indicator rețea */}
                    <span
                        className={`network-indicator ${networkInfo?.isSupported ? 'supported' : 'unsupported'}`}
                        title={networkInfo?.name || 'Unknown Network'}
                    ></span>

                    {/* Balanță */}
                    {balance && (
                        <span className="wallet-balance">
                            {balance.formatted} {balance.symbol}
                        </span>
                    )}

                    {/* Adresă */}
                    <span className="wallet-address">
                        {shortAddress}
                    </span>

                    {/* Icon dropdown */}
                    <span className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>▼</span>
                </button>

                {/* Dropdown menu */}
                {showDropdown && (
                    <div className="wallet-dropdown">
                        <div className="wallet-dropdown-header">
                            <span className="wallet-network">{networkInfo?.name}</span>
                        </div>

                        <div className="wallet-dropdown-address">
                            <span title={shortAddress}>
                                {shortAddress}
                            </span>
                            <button
                                className="copy-button"
                                onClick={() => {
                                    navigator.clipboard.writeText(shortAddress);
                                }}
                                title="Copiază adresa"
                            >
                                📋
                            </button>
                        </div>

                        <div className="wallet-dropdown-balance">
                            <span>Balanță:</span>
                            <strong>{balance?.formatted} {balance?.symbol}</strong>
                        </div>

                        <div className="wallet-dropdown-divider"></div>

                        <button
                            className="wallet-dropdown-item"
                            onClick={() => {
                                disconnect();
                                setShowDropdown(false);
                            }}
                        >
                            🔌 Deconectează
                        </button>
                    </div>
                )}

                {/* Overlay pentru închidere dropdown */}
                {showDropdown && (
                    <div
                        className="wallet-dropdown-overlay"
                        onClick={() => setShowDropdown(false)}
                    ></div>
                )}
            </div>
        );
    }

    // Buton pentru conectare
    return (
        <div className="wallet-container">
            <button
                className="wallet-button wallet-connect"
                onClick={handleClick}
            >
                <span className="wallet-icon">🦊</span>
                Connect Wallet
            </button>

            {/* Afișează eroare dacă există */}
            {error && (
                <div className="wallet-error">
                    <span>{error}</span>
                    <button onClick={clearError}>✕</button>
                </div>
            )}
        </div>
    );
}

export default WalletButton;
