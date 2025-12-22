/**
 * IPFS Gateway Fallback
 * 
 * Provides public gateway access when local IPFS node is not available
 */

const axios = require('axios');

const PUBLIC_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://gateway.ipfs.io/ipfs/'
];

class IPFSGatewayFallback {
  constructor() {
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Download file from IPFS via public gateways
   * @param {string} cid - Content identifier
   * @returns {Promise<Buffer>} File data
   */
  async downloadFile(cid) {
    const errors = [];

    for (const gateway of PUBLIC_GATEWAYS) {
      try {
        console.log(`[IPFS-GATEWAY] Trying ${gateway}${cid}`);
        
        const response = await axios.get(`${gateway}${cid}`, {
          responseType: 'arraybuffer',
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Distributed-Cloud-Storage/1.0'
          }
        });

        if (response.status === 200 && response.data) {
          console.log(`[IPFS-GATEWAY] ✓ Downloaded from ${gateway}`);
          return response.data;
        }
      } catch (error) {
        errors.push(`${gateway}: ${error.message}`);
        continue;
      }
    }

    throw new Error(`Failed to download ${cid} from all gateways:\n${errors.join('\n')}`);
  }

  /**
   * Get file metadata via gateway
   * @param {string} cid - Content identifier
   * @returns {Promise<Object>} Metadata
   */
  async getMetadata(cid) {
    for (const gateway of PUBLIC_GATEWAYS) {
      try {
        const response = await axios.head(`${gateway}${cid}`, {
          timeout: this.timeout
        });

        return {
          size: parseInt(response.headers['content-length'] || '0'),
          contentType: response.headers['content-type'] || 'application/octet-stream',
          lastModified: response.headers['last-modified'] || null
        };
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Failed to get metadata for ${cid}`);
  }

  /**
   * Check if CID is accessible via gateways
   * @param {string} cid - Content identifier
   * @returns {Promise<boolean>}
   */
  async isAccessible(cid) {
    for (const gateway of PUBLIC_GATEWAYS) {
      try {
        const response = await axios.head(`${gateway}${cid}`, {
          timeout: 5000
        });

        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  }

  /**
   * Get best performing gateway
   * @returns {Promise<string>} Gateway URL
   */
  async getBestGateway() {
    const testCID = 'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o'; // IPFS logo

    const results = await Promise.allSettled(
      PUBLIC_GATEWAYS.map(async (gateway) => {
        const start = Date.now();
        await axios.head(`${gateway}${testCID}`, { timeout: 3000 });
        return { gateway, responseTime: Date.now() - start };
      })
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => a.responseTime - b.responseTime);

    if (successful.length > 0) {
      console.log(`[IPFS-GATEWAY] Best gateway: ${successful[0].gateway} (${successful[0].responseTime}ms)`);
      return successful[0].gateway;
    }

    return PUBLIC_GATEWAYS[0];
  }
}

module.exports = new IPFSGatewayFallback();
