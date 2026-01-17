const { DataAccessor } = require('@solid/community-server');
const { guardedStreamFrom } = require('@solid/community-server');
const axios = require('axios');
const FormData = require('form-data');
const { Readable } = require('stream');
const path = require('path');

class IPFSDataAccessor extends DataAccessor {
  constructor(ipfsClusterUrl) {
    super();
    this.ipfsClusterUrl = ipfsClusterUrl || 'http://localhost:9094';
    this.apiKey = 'supersecret';
    console.log(`[IPFS-ACCESSOR] Initialized with cluster: ${this.ipfsClusterUrl}`);
  }
  // verific daca pot gestiona reprezentarea dată
  // ipfs stocheaza bytes raw
  async canHandle(representation) {
    if (representation.binary) {
      return;
    }
    throw new Error('IPFSDataAccessor only handles binary data');
  }
  // cineva cere un fisier din pod
  async getData(identifier) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      // verific daca e director
      const stats = await this.getStats(ipfsPath);
      if (stats.type === 'directory') {
        throw new Error('Cannot read data from container resource');
      }
      // get la ipfs cluster
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

  async writeDocument(identifier, data, metadata) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);

      const parentPath = path.dirname(ipfsPath);
      await this.ensureDirectory(parentPath);

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
      if (!error.response?.data?.includes('already exists')) {
        console.error('[IPFS-ACCESSOR] writeContainer error:', error.message);
        throw new Error(`Failed to create container in IPFS: ${error.message}`);
      }
    }
  }

  async deleteResource(identifier) {
    try {
      const ipfsPath = this.urlToIPFSPath(identifier.path);
      const stats = await this.getStats(ipfsPath);

      if (stats.type === 'directory') {
        await axios.post(`${this.ipfsClusterUrl}/mfs/rm`, null, {
          params: {
            arg: ipfsPath,
            recursive: true
          },
          headers: { 'x-api-key': this.apiKey }
        });
      } else {
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

  urlToIPFSPath(url) {
    let ipfsPath = url.replace(/^https?:\/\/[^\/]+/, '');

    if (!ipfsPath.startsWith('/')) {
      ipfsPath = '/' + ipfsPath;
    }

    return ipfsPath;
  }

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

  async ensureDirectory(ipfsPath) {
    try {
      await this.getStats(ipfsPath);
    } catch (error) {
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
