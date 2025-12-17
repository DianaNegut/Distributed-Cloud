/**
 * IPFS Data Accessor for Community Solid Server
 * 
 * Implementează interfața DataAccessor din CSS pentru a integra IPFS Cluster
 * ca backend de stocare pentru Solid PODs.
 * 
 * Bazat pe articolul: "Solid over the Interplanetary File System"
 * by Fabrizio Parrillo & Christian Tschudin
 */

const { DataAccessor } = require('@solid/community-server');
const { guardedStreamFrom } = require('@solid/community-server');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const path = require('path');

/**
 * IPFSDataAccessor - Conectează CSS cu IPFS Cluster
 * 
 * Mapează operațiile Solid (read, write, delete) la operațiile IPFS MFS
 */
class IPFSDataAccessor extends DataAccessor {
  constructor(ipfsClusterUrl) {
    super();
    this.ipfsClusterUrl = ipfsClusterUrl || 'http://localhost:9094';
    this.apiKey = 'supersecret'; // Ar trebui să vină din configurație
    console.log(`[IPFS-ACCESSOR] Initialized with cluster: ${this.ipfsClusterUrl}`);
  }

  /**
   * Verifică dacă poate gestiona reprezentarea dată
   * @param {Representation} representation
   */
  async canHandle(representation) {
    // Acceptăm orice tip de reprezentare binară
    if (representation.binary) {
      return;
    }
    throw new Error('IPFSDataAccessor only handles binary data');
  }

  /**
   * Citește date de la o resursă IPFS
   * @param {ResourceIdentifier} identifier
   * @returns {Promise<Readable>}
   */
  async getData(identifier) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      
      // Verifică dacă este container (director)
      const stats = await this.getStats(ipfsPath);
      if (stats.type === 'directory') {
        throw new Error('Cannot read data from container resource');
      }

      // Citește fișierul din IPFS MFS
      const response = await axios.get(`${this.ipfsClusterUrl}/mfs/read`, {
        params: { arg: ipfsPath },
        headers: { 'x-api-key': this.apiKey },
        responseType: 'stream'
      });

      return guardedStreamFrom(response.data);
    } catch (error) {
      console.error('[IPFS-ACCESSOR] getData error:', error.message);
      throw new Error(`Failed to read from IPFS: ${error.message}`);
    }
  }

  /**
   * Obține metadata pentru o resursă
   * @param {ResourceIdentifier} identifier
   * @returns {Promise<RepresentationMetadata>}
   */
  async getMetadata(identifier) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      const stats = await this.getStats(ipfsPath);

      const metadata = {
        contentType: stats.type === 'directory' 
          ? 'text/turtle' 
          : 'application/octet-stream',
        size: stats.size,
        modified: new Date(stats.mtime * 1000),
        isContainer: stats.type === 'directory',
        cid: stats.cid
      };

      // Dacă este container, listează conținutul
      if (stats.type === 'directory') {
        const children = await this.listDirectory(ipfsPath);
        metadata.children = children;
      }

      return metadata;
    } catch (error) {
      if (error.message.includes('does not exist')) {
        throw new Error('Resource not found');
      }
      throw error;
    }
  }

  /**
   * Scrie un document în IPFS
   * @param {ResourceIdentifier} identifier
   * @param {Readable} data
   * @param {RepresentationMetadata} metadata
   */
  async writeDocument(identifier, data, metadata) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      
      // Asigură-te că directorul părinte există
      const parentPath = path.dirname(ipfsPath);
      await this.ensureDirectory(parentPath);

      // Uploadează fișierul pe IPFS
      const formData = new FormData();
      formData.append('file', data);

      const response = await axios.post(`${this.ipfsClusterUrl}/mfs/write`, formData, {
        params: { 
          arg: ipfsPath,
          create: true,
          truncate: true
        },
        headers: {
          ...formData.getHeaders(),
          'x-api-key': this.apiKey
        }
      });

      console.log(`[IPFS-ACCESSOR] Written document: ${ipfsPath}`);
    } catch (error) {
      console.error('[IPFS-ACCESSOR] writeDocument error:', error.message);
      throw new Error(`Failed to write to IPFS: ${error.message}`);
    }
  }

  /**
   * Creează un container (director)
   * @param {ResourceIdentifier} identifier
   * @param {RepresentationMetadata} metadata
   */
  async writeContainer(identifier, metadata) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      
      await axios.post(`${this.ipfsClusterUrl}/mfs/mkdir`, null, {
        params: { 
          arg: ipfsPath,
          parents: true
        },
        headers: { 'x-api-key': this.apiKey }
      });

      console.log(`[IPFS-ACCESSOR] Created container: ${ipfsPath}`);
    } catch (error) {
      // Ignoră eroarea dacă directorul există deja
      if (!error.response?.data?.includes('already exists')) {
        console.error('[IPFS-ACCESSOR] writeContainer error:', error.message);
        throw new Error(`Failed to create container in IPFS: ${error.message}`);
      }
    }
  }

  /**
   * Șterge o resursă din IPFS
   * @param {ResourceIdentifier} identifier
   */
  async deleteResource(identifier) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      const stats = await this.getStats(ipfsPath);

      if (stats.type === 'directory') {
        // Șterge director
        await axios.post(`${this.ipfsClusterUrl}/mfs/rm`, null, {
          params: { 
            arg: ipfsPath,
            recursive: true
          },
          headers: { 'x-api-key': this.apiKey }
        });
      } else {
        // Șterge fișier
        await axios.post(`${this.ipfsClusterUrl}/mfs/rm`, null, {
          params: { arg: ipfsPath },
          headers: { 'x-api-key': this.apiKey }
        });
      }

      console.log(`[IPFS-ACCESSOR] Deleted resource: ${ipfsPath}`);
    } catch (error) {
      console.error('[IPFS-ACCESSOR] deleteResource error:', error.message);
      throw new Error(`Failed to delete from IPFS: ${error.message}`);
    }
  }

  // === HELPER METHODS ===

  /**
   * Convertește URL Solid la path IPFS MFS
   * @param {string} url
   * @returns {string}
   */
  urlToIPFSPath(url) {
    // Remove base URL and leading slash for IPFS MFS path
    let ipfsPath = url.replace(/^https?:\/\/[^\/]+/, '');
    
    // Asigură-te că începe cu /
    if (!ipfsPath.startsWith('/')) {
      ipfsPath = '/' + ipfsPath;
    }

    return ipfsPath;
  }

  /**
   * Obține statistici pentru un path IPFS
   * @param {string} ipfsPath
   * @returns {Promise<Object>}
   */
  async getStats(ipfsPath) {
    try {
      const response = await axios.post(`${this.ipfsClusterUrl}/mfs/stat`, null, {
        params: { arg: ipfsPath },
        headers: { 'x-api-key': this.apiKey }
      });

      return {
        type: response.data.Type === 0 ? 'file' : 'directory',
        size: response.data.Size || 0,
        cid: response.data.Hash,
        mtime: response.data.Mtime || Math.floor(Date.now() / 1000)
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Resource does not exist');
      }
      throw error;
    }
  }

  /**
   * Listează conținutul unui director
   * @param {string} ipfsPath
   * @returns {Promise<Array>}
   */
  async listDirectory(ipfsPath) {
    try {
      const response = await axios.post(`${this.ipfsClusterUrl}/mfs/ls`, null, {
        params: { arg: ipfsPath },
        headers: { 'x-api-key': this.apiKey }
      });

      if (!response.data.Entries) {
        return [];
      }

      return response.data.Entries.map(entry => ({
        name: entry.Name,
        type: entry.Type === 0 ? 'file' : 'directory',
        size: entry.Size || 0,
        cid: entry.Hash
      }));
    } catch (error) {
      console.error('[IPFS-ACCESSOR] listDirectory error:', error.message);
      return [];
    }
  }

  /**
   * Asigură că un director există
   * @param {string} ipfsPath
   */
  async ensureDirectory(ipfsPath) {
    try {
      await this.getStats(ipfsPath);
    } catch (error) {
      // Directorul nu există, creează-l
      await axios.post(`${this.ipfsClusterUrl}/mfs/mkdir`, null, {
        params: { 
          arg: ipfsPath,
          parents: true
        },
        headers: { 'x-api-key': this.apiKey }
      });
    }
  }
}

module.exports = IPFSDataAccessor;
