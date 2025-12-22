/**
 * File Ownership & Access Control
 * 
 * Manages CID → WebID mappings and Access Control Lists
 */

const fs = require('fs');
const path = require('path');
const { IPFS_PATH } = require('../config/paths');

const OWNERSHIP_FILE = path.join(IPFS_PATH, 'file-ownership.json');

class FileOwnership {
  constructor() {
    this.ownership = new Map();
    this.loadOwnership();
  }

  /**
   * Load ownership data from disk
   */
  loadOwnership() {
    try {
      if (fs.existsSync(OWNERSHIP_FILE)) {
        const data = fs.readFileSync(OWNERSHIP_FILE, 'utf8');
        const parsed = JSON.parse(data);
        this.ownership = new Map(Object.entries(parsed));
        console.log(`[FILE-OWNERSHIP] Loaded ${this.ownership.size} file ownership records`);
      }
    } catch (error) {
      console.error('[FILE-OWNERSHIP] Error loading ownership:', error.message);
      this.ownership = new Map();
    }
  }

  /**
   * Save ownership data to disk
   */
  saveOwnership() {
    try {
      const data = Object.fromEntries(this.ownership);
      fs.writeFileSync(OWNERSHIP_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[FILE-OWNERSHIP] Error saving ownership:', error.message);
    }
  }

  /**
   * Register file ownership
   * @param {string} cid - Content identifier
   * @param {string} webId - Owner's WebID
   * @param {Object} metadata - Additional file metadata
   */
  registerFile(cid, webId, metadata = {}) {
    const record = {
      owner: webId,
      uploadedAt: new Date().toISOString(),
      accessList: [webId], // Owner has default access
      metadata: {
        filename: metadata.filename || 'unknown',
        size: metadata.size || 0,
        mimeType: metadata.mimeType || 'application/octet-stream'
      }
    };

    this.ownership.set(cid, record);
    this.saveOwnership();
    console.log(`[FILE-OWNERSHIP] Registered ${cid} → ${webId}`);
    return record;
  }

  /**
   * Check if user can access file
   * @param {string} cid - Content identifier
   * @param {string} webId - User's WebID
   * @returns {boolean}
   */
  canAccess(cid, webId) {
    const record = this.ownership.get(cid);
    if (!record) {
      // File not registered - allow access (legacy files)
      return true;
    }
    return record.accessList.includes(webId);
  }

  /**
   * Check if user is owner
   * @param {string} cid - Content identifier
   * @param {string} webId - User's WebID
   * @returns {boolean}
   */
  isOwner(cid, webId) {
    const record = this.ownership.get(cid);
    return record && record.owner === webId;
  }

  /**
   * Grant access to another user
   * @param {string} cid - Content identifier
   * @param {string} ownerWebId - Owner's WebID
   * @param {string} targetWebId - User to grant access to
   * @returns {boolean} Success
   */
  grantAccess(cid, ownerWebId, targetWebId) {
    const record = this.ownership.get(cid);
    if (!record) {
      console.error(`[FILE-OWNERSHIP] File ${cid} not found`);
      return false;
    }

    if (record.owner !== ownerWebId) {
      console.error(`[FILE-OWNERSHIP] ${ownerWebId} is not owner of ${cid}`);
      return false;
    }

    if (!record.accessList.includes(targetWebId)) {
      record.accessList.push(targetWebId);
      this.saveOwnership();
      console.log(`[FILE-OWNERSHIP] Granted access: ${cid} → ${targetWebId}`);
    }

    return true;
  }

  /**
   * Revoke access from user
   * @param {string} cid - Content identifier
   * @param {string} ownerWebId - Owner's WebID
   * @param {string} targetWebId - User to revoke access from
   * @returns {boolean} Success
   */
  revokeAccess(cid, ownerWebId, targetWebId) {
    const record = this.ownership.get(cid);
    if (!record) {
      return false;
    }

    if (record.owner !== ownerWebId) {
      return false;
    }

    // Cannot revoke owner's access
    if (targetWebId === ownerWebId) {
      return false;
    }

    record.accessList = record.accessList.filter(id => id !== targetWebId);
    this.saveOwnership();
    console.log(`[FILE-OWNERSHIP] Revoked access: ${cid} ✗ ${targetWebId}`);
    return true;
  }

  /**
   * Get files owned by user
   * @param {string} webId - User's WebID
   * @returns {Array} List of CIDs
   */
  getOwnedFiles(webId) {
    const files = [];
    for (const [cid, record] of this.ownership.entries()) {
      if (record.owner === webId) {
        files.push({
          cid,
          ...record
        });
      }
    }
    return files;
  }

  /**
   * Get files accessible by user
   * @param {string} webId - User's WebID
   * @returns {Array} List of CIDs
   */
  getAccessibleFiles(webId) {
    const files = [];
    for (const [cid, record] of this.ownership.entries()) {
      if (record.accessList.includes(webId)) {
        files.push({
          cid,
          ...record,
          isOwner: record.owner === webId
        });
      }
    }
    return files;
  }

  /**
   * Get file metadata
   * @param {string} cid - Content identifier
   * @returns {Object|null}
   */
  getFileInfo(cid) {
    return this.ownership.get(cid) || null;
  }

  /**
   * Delete file ownership record
   * @param {string} cid - Content identifier
   * @param {string} webId - Owner's WebID
   * @returns {boolean}
   */
  deleteFile(cid, webId) {
    const record = this.ownership.get(cid);
    if (!record || record.owner !== webId) {
      return false;
    }

    this.ownership.delete(cid);
    this.saveOwnership();
    console.log(`[FILE-OWNERSHIP] Deleted ${cid}`);
    return true;
  }
}

module.exports = new FileOwnership();
