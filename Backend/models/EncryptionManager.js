/**
 * Encryption Manager
 * 
 * Handles AES-256 encryption/decryption for files before IPFS storage
 * Key management per POD WebID
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const KEYS_FILE = path.join(IPFS_PATH, 'encryption-keys.json');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

class EncryptionManager {
  constructor() {
    this.keys = new Map();
    this.loadKeys();
  }

  /**
   * Load encryption keys from disk
   */
  loadKeys() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const data = fs.readFileSync(KEYS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        this.keys = new Map(Object.entries(parsed));
        console.log(`[ENCRYPTION] Loaded ${this.keys.size} encryption keys`);
      }
    } catch (error) {
      console.error('[ENCRYPTION] Error loading keys:', error.message);
      this.keys = new Map();
    }
  }

  /**
   * Save encryption keys to disk (encrypted storage)
   */
  saveKeys() {
    try {
      const dir = path.dirname(KEYS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Object.fromEntries(this.keys);
      fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
      
      // Set restrictive permissions (owner only)
      if (process.platform !== 'win32') {
        fs.chmodSync(KEYS_FILE, 0o600);
      }
    } catch (error) {
      console.error('[ENCRYPTION] Error saving keys:', error.message);
    }
  }

  /**
   * Generate encryption key for user
   * @param {string} webId - User's WebID
   * @returns {string} Base64 encoded key
   */
  generateKey(webId) {
    if (this.keys.has(webId)) {
      return this.keys.get(webId);
    }

    const key = crypto.randomBytes(KEY_LENGTH).toString('base64');
    this.keys.set(webId, key);
    this.saveKeys();
    
    console.log(`[ENCRYPTION] Generated new key for ${webId}`);
    return key;
  }

  /**
   * Get user's encryption key
   * @param {string} webId - User's WebID
   * @returns {string|null} Base64 encoded key
   */
  getKey(webId) {
    return this.keys.get(webId) || null;
  }

  /**
   * Encrypt file data
   * @param {Buffer} data - File data to encrypt
   * @param {string} webId - User's WebID
   * @returns {Object} { encryptedData: Buffer, metadata: Object }
   */
  encryptFile(data, webId) {
    try {
      let keyBase64 = this.getKey(webId);
      if (!keyBase64) {
        keyBase64 = this.generateKey(webId);
      }

      const key = Buffer.from(keyBase64, 'base64');
      const iv = crypto.randomBytes(IV_LENGTH);
      
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(data),
        cipher.final()
      ]);
      
      const authTag = cipher.getAuthTag();

      // Combine IV + Auth Tag + Encrypted Data
      const encryptedData = Buffer.concat([iv, authTag, encrypted]);

      const metadata = {
        algorithm: ALGORITHM,
        ivLength: IV_LENGTH,
        authTagLength: AUTH_TAG_LENGTH,
        originalSize: data.length,
        encryptedSize: encryptedData.length,
        encryptedAt: new Date().toISOString()
      };

      console.log(`[ENCRYPTION] File encrypted: ${data.length} → ${encryptedData.length} bytes`);
      
      return { encryptedData, metadata };
    } catch (error) {
      console.error('[ENCRYPTION] Encryption failed:', error.message);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt file data
   * @param {Buffer} encryptedData - Encrypted data (IV + AuthTag + Data)
   * @param {string} webId - User's WebID
   * @returns {Buffer} Decrypted data
   */
  decryptFile(encryptedData, webId) {
    try {
      const keyBase64 = this.getKey(webId);
      if (!keyBase64) {
        throw new Error('Encryption key not found for user');
      }

      const key = Buffer.from(keyBase64, 'base64');

      // Extract IV, Auth Tag, and encrypted data
      const iv = encryptedData.slice(0, IV_LENGTH);
      const authTag = encryptedData.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = encryptedData.slice(IV_LENGTH + AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      console.log(`[ENCRYPTION] File decrypted: ${encryptedData.length} → ${decrypted.length} bytes`);
      
      return decrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Decryption failed:', error.message);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt file metadata
   * @param {Object} metadata - File metadata
   * @param {string} webId - User's WebID
   * @returns {string} Encrypted metadata (base64)
   */
  encryptMetadata(metadata, webId) {
    try {
      const jsonData = JSON.stringify(metadata);
      const buffer = Buffer.from(jsonData, 'utf8');
      const { encryptedData } = this.encryptFile(buffer, webId);
      return encryptedData.toString('base64');
    } catch (error) {
      console.error('[ENCRYPTION] Metadata encryption failed:', error.message);
      throw error;
    }
  }

  /**
   * Decrypt file metadata
   * @param {string} encryptedMetadata - Base64 encrypted metadata
   * @param {string} webId - User's WebID
   * @returns {Object} Decrypted metadata
   */
  decryptMetadata(encryptedMetadata, webId) {
    try {
      const buffer = Buffer.from(encryptedMetadata, 'base64');
      const decrypted = this.decryptFile(buffer, webId);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('[ENCRYPTION] Metadata decryption failed:', error.message);
      throw error;
    }
  }

  /**
   * Rotate encryption key for user
   * @param {string} webId - User's WebID
   * @returns {string} New key
   */
  rotateKey(webId) {
    const oldKey = this.keys.get(webId);
    const newKey = crypto.randomBytes(KEY_LENGTH).toString('base64');
    
    this.keys.set(webId, newKey);
    this.saveKeys();
    
    console.log(`[ENCRYPTION] Key rotated for ${webId}`);
    
    return {
      oldKey,
      newKey,
      rotatedAt: new Date().toISOString()
    };
  }

  /**
   * Delete user's encryption key
   * @param {string} webId - User's WebID
   */
  deleteKey(webId) {
    if (this.keys.has(webId)) {
      this.keys.delete(webId);
      this.saveKeys();
      console.log(`[ENCRYPTION] Key deleted for ${webId}`);
      return true;
    }
    return false;
  }

  /**
   * Export user's key (for backup)
   * @param {string} webId - User's WebID
   * @param {string} password - Password to encrypt key
   * @returns {string} Encrypted key export
   */
  exportKey(webId, password) {
    const key = this.getKey(webId);
    if (!key) {
      throw new Error('Key not found');
    }

    // Derive key from password using PBKDF2
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    // Encrypt the key
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(key, 'base64')),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    const exportData = {
      version: 1,
      webId,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encryptedKey: encrypted.toString('base64'),
      exportedAt: new Date().toISOString()
    };

    return Buffer.from(JSON.stringify(exportData)).toString('base64');
  }

  /**
   * Import user's key from backup
   * @param {string} exportedData - Base64 encoded export
   * @param {string} password - Password to decrypt key
   * @returns {boolean} Success
   */
  importKey(exportedData, password) {
    try {
      const exportData = JSON.parse(Buffer.from(exportedData, 'base64').toString('utf8'));
      
      const salt = Buffer.from(exportData.salt, 'base64');
      const iv = Buffer.from(exportData.iv, 'base64');
      const authTag = Buffer.from(exportData.authTag, 'base64');
      const encrypted = Buffer.from(exportData.encryptedKey, 'base64');

      // Derive key from password
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      // Decrypt the key
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      const key = decrypted.toString('base64');
      
      this.keys.set(exportData.webId, key);
      this.saveKeys();

      console.log(`[ENCRYPTION] Key imported for ${exportData.webId}`);
      return true;
    } catch (error) {
      console.error('[ENCRYPTION] Key import failed:', error.message);
      throw new Error('Invalid export data or password');
    }
  }
}

module.exports = new EncryptionManager();
