/**
 * Client-Side File Encryption & Decryption
 * Uses AES-256-GCM for secure encryption
 */

class FileEncryption {
  /**
   * Generate a new encryption key for a contract
   * @returns {Promise<{key: CryptoKey, keyString: string}>}
   */
  static async generateKey() {
    const key = await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );

    // Export key as base64 string for storage
    const exported = await window.crypto.subtle.exportKey('raw', key);
    const keyString = btoa(String.fromCharCode(...new Uint8Array(exported)));

    return { key, keyString };
  }

  /**
   * Import encryption key from string
   * @param {string} keyString - Base64 encoded key
   * @returns {Promise<CryptoKey>}
   */
  static async importKey(keyString) {
    const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a file
   * @param {File} file - File to encrypt
   * @param {CryptoKey} key - Encryption key
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{encryptedBlob: Blob, iv: string, originalName: string, originalSize: number}>}
   */
  static async encryptFile(file, key, onProgress = null) {
    try {
      // Read file as ArrayBuffer
      const fileBuffer = await file.arrayBuffer();
      
      if (onProgress) onProgress(25, 'Reading file...');

      // Generate random IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      if (onProgress) onProgress(50, 'Encrypting...');

      // Encrypt the file
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        fileBuffer
      );

      if (onProgress) onProgress(75, 'Finalizing...');

      // Create metadata object
      const metadata = {
        originalName: file.name,
        originalSize: file.size,
        mimeType: file.type,
        encryptedAt: new Date().toISOString()
      };

      // Combine metadata + encrypted data
      const metadataString = JSON.stringify(metadata);
      const metadataBuffer = new TextEncoder().encode(metadataString);
      const metadataLength = new Uint32Array([metadataBuffer.length]);

      // Format: [metadataLength(4 bytes)][metadata][encrypted data]
      const encryptedBlob = new Blob([
        metadataLength,
        metadataBuffer,
        encrypted
      ]);

      if (onProgress) onProgress(100, 'Complete');

      return {
        encryptedBlob,
        iv: btoa(String.fromCharCode(...iv)),
        originalName: file.name,
        originalSize: file.size,
        encryptedSize: encryptedBlob.size
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt file: ' + error.message);
    }
  }

  /**
   * Decrypt a file
   * @param {Blob} encryptedBlob - Encrypted file blob
   * @param {CryptoKey} key - Decryption key
   * @param {string} ivString - Base64 encoded IV
   * @param {Object} externalMetadata - Optional external metadata (if not embedded)
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<{decryptedBlob: Blob, metadata: Object}>}
   */
  static async decryptFile(encryptedBlob, key, ivString, externalMetadata = null, onProgress = null) {
    try {
      if (onProgress) onProgress(10, 'Reading encrypted file...');

      // Read encrypted blob
      const encryptedBuffer = await encryptedBlob.arrayBuffer();
      console.log('Total encrypted buffer size:', encryptedBuffer.byteLength);
      
      let metadata = externalMetadata;
      let encryptedData = encryptedBuffer;

      // Always try to extract embedded metadata first (our files have it embedded)
      try {
        const dataView = new DataView(encryptedBuffer);

        // Read metadata length (first 4 bytes)
        const metadataLength = dataView.getUint32(0, true);
        console.log('Embedded metadata length:', metadataLength);

        if (metadataLength > 0 && metadataLength < 10000) { // Sanity check
          if (onProgress) onProgress(30, 'Parsing metadata...');

          // Extract metadata
          const metadataBuffer = encryptedBuffer.slice(4, 4 + metadataLength);
          const metadataString = new TextDecoder().decode(metadataBuffer);
          console.log('Embedded metadata string:', metadataString);
          const embeddedMetadata = JSON.parse(metadataString);
          console.log('Parsed embedded metadata:', embeddedMetadata);

          // Use embedded metadata if no external provided
          if (!externalMetadata) {
            metadata = embeddedMetadata;
          } else {
            console.log('Using external metadata but skipping embedded section');
          }

          // ALWAYS extract encrypted data after metadata section
          encryptedData = encryptedBuffer.slice(4 + metadataLength);
          console.log('Encrypted data size (after skipping metadata):', encryptedData.byteLength);
        } else {
          console.warn('Invalid metadata length, treating entire blob as encrypted data');
          encryptedData = encryptedBuffer;
        }
      } catch (metaError) {
        console.warn('Failed to parse embedded metadata, using entire blob:', metaError.message);
        encryptedData = encryptedBuffer;
      }
      
      if (externalMetadata) {
        console.log('Final metadata (external):', externalMetadata);
      }

      if (onProgress) onProgress(50, 'Decrypting...');

      // Convert IV from base64
      const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));

      console.log('Decrypting with IV:', ivString);
      console.log('IV bytes:', iv);
      console.log('Encrypted data size:', encryptedData.byteLength || encryptedData.size);

      // Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      );

      if (onProgress) onProgress(90, 'Finalizing...');

      // Create blob with original mime type
      const mimeType = metadata?.mimeType || 'application/octet-stream';
      const decryptedBlob = new Blob([decrypted], { type: mimeType });

      if (onProgress) onProgress(100, 'Complete');

      return {
        decryptedBlob,
        metadata: metadata || {}
      };
    } catch (error) {
      console.error('Decryption error:', error);
      console.error('Error details:', error.message, error.stack);
      throw new Error('Failed to decrypt file. The key might be incorrect or the file is corrupted.');
    }
  }

  /**
   * Generate key from password (for user-friendly key management)
   * @param {string} password - User password
   * @param {string} salt - Salt (should be stored with contract)
   * @returns {Promise<CryptoKey>}
   */
  static async deriveKeyFromPassword(password, salt = null) {
    // Generate or use existing salt
    const saltBuffer = salt 
      ? Uint8Array.from(atob(salt), c => c.charCodeAt(0))
      : window.crypto.getRandomValues(new Uint8Array(16));

    const passwordBuffer = new TextEncoder().encode(password);

    // Derive key using PBKDF2
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    const saltString = btoa(String.fromCharCode(...saltBuffer));

    return { key, salt: saltString };
  }
}

export default FileEncryption;
