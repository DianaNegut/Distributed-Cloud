/**
 * Solid-IPFS Adapter
 * 
 * Adapter pentru stocarea datelor Solid POD pe IPFS
 * Implementează compatibilitate cu Linked Data Platform (LDP)
 * 
 * Acest adapter permite ca datele Solid să fie persistent pe IPFS
 * în loc de un filesystem tradițional, menținând compatibilitatea
 * cu specificația Solid și aplicațiile existente.
 */

const FormData = require('form-data');
const axios = require('axios');
const path = require('path');

class SolidIPFSAdapter {
  constructor(dockerClusterClient) {
    this.clusterClient = dockerClusterClient;
  }

  /**
   * Creează structura de directoare pentru un POD Solid
   * Conform specificației Solid, un POD are următoarea structură:
   * 
   * /
   * ├── profile/         (Public profile information)
   * │   └── card         (WebID Profile Document)
   * ├── public/          (Publicly readable resources)
   * ├── private/         (Private resources)
   * ├── inbox/           (Notifications & messages)
   * └── settings/        (User preferences)
   * 
   * @param {Object} podData - Date POD
   * @returns {Promise<Object>} CID-uri pentru fiecare container
   */
  async initializePodStructure(podData) {
    console.log(`[SOLID-IPFS] Initializing POD structure for ${podData.username}`);

    try {
      // Creează Profile Document (WebID card)
      const profileCard = this.createProfileCard(podData);
      const profileCid = await this.uploadDocument(profileCard, 'card.ttl');

      // Creează README pentru fiecare container
      const publicReadme = this.createContainerReadme('public', 'Public resources accessible to everyone');
      const publicCid = await this.uploadDocument(publicReadme, 'README.md');

      const privateReadme = this.createContainerReadme('private', 'Private resources - only accessible to owner');
      const privateCid = await this.uploadDocument(privateReadme, 'README.md');

      const inboxReadme = this.createContainerReadme('inbox', 'Inbox for notifications and messages');
      const inboxCid = await this.uploadDocument(inboxReadme, 'README.md');

      const settingsReadme = this.createContainerReadme('settings', 'User settings and preferences');
      const settingsCid = await this.uploadDocument(settingsReadme, 'README.md');

      console.log(`[SOLID-IPFS] POD structure initialized successfully`);

      return {
        profile: profileCid,
        public: publicCid,
        private: privateCid,
        inbox: inboxCid,
        settings: settingsCid
      };
    } catch (error) {
      console.error(`[SOLID-IPFS] Error initializing POD structure:`, error.message);
      throw error;
    }
  }

  /**
   * Creează WebID Profile Card în format Turtle (RDF)
   * Acesta este documentul principal de identitate în Solid
   * 
   * @param {Object} podData - Date POD
   * @returns {string} Conținut Turtle
   */
  createProfileCard(podData) {
    const { webId, name, username, ownerId } = podData;

    return `@prefix : <#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix pro: <./>.
@prefix schema: <http://schema.org/>.
@prefix ldp: <http://www.w3.org/ns/ldp#>.

pro:card a foaf:PersonalProfileDocument; foaf:maker :me; foaf:primaryTopic :me.

:me
    a foaf:Person, schema:Person;
    foaf:name "${name}";
    foaf:nick "${username}";
    solid:oidcIssuer <http://localhost:3001/>;
    
    # Storage
    solid:storage <..>;
    
    # Linked containers
    ldp:inbox </inbox/>;
    solid:publicTypeIndex </settings/publicTypeIndex.ttl>;
    solid:privateTypeIndex </settings/privateTypeIndex.ttl>;
    
    # Preferences
    solid:preferencesFile </settings/prefs.ttl>;
    
    # Owner ID
    solid:account "${ownerId}".
`;
  }

  /**
   * Creează README pentru un container
   */
  createContainerReadme(containerName, description) {
    return `# ${containerName.charAt(0).toUpperCase() + containerName.slice(1)} Container

${description}

This is part of a Solid POD stored on IPFS.

## About Solid

Solid (Social Linked Data) is a web decentralization project led by Tim Berners-Lee.
It allows users to store their data in decentralized data stores called PODs (Personal Online Datastores).

## About IPFS Storage

This POD uses IPFS (InterPlanetary File System) as the backend storage layer,
providing content-addressable, peer-to-peer hypermedia distribution.

Last updated: ${new Date().toISOString()}
`;
  }

  /**
   * Upload document pe IPFS via cluster
   * 
   * @param {string|Buffer} content - Conținut document
   * @param {string} filename - Nume fișier
   * @returns {Promise<string>} CID document
   */
  async uploadDocument(content, filename) {
    try {
      // Creează form data
      const formData = new FormData();
      formData.append('file', Buffer.from(content), {
        filename: filename,
        contentType: 'text/plain'
      });

      // Upload prin cluster client
      const response = await this.clusterClient.executeWithRetry(async (node) => {
        return await axios.post(`${node}/add`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          params: {
            'replication-min': 2,
            'replication-max': 3
          },
          timeout: 30000
        });
      });

      const cid = response.data.cid;
      console.log(`[SOLID-IPFS] Uploaded document ${filename}: ${cid}`);
      
      return cid;
    } catch (error) {
      console.error(`[SOLID-IPFS] Error uploading document:`, error.message);
      throw error;
    }
  }

  /**
   * Upload fișier în POD
   * 
   * @param {Object} file - Fișier de upload (Express file object)
   * @param {string} containerPath - Calea containerului (/public/, /private/, etc.)
   * @param {Object} metadata - Metadata adițională
   * @returns {Promise<Object>} Info despre upload
   */
  async uploadFileToPod(file, containerPath, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file.data, {
        filename: file.name,
        contentType: file.mimetype
      });

      // Upload prin cluster
      const response = await this.clusterClient.executeWithRetry(async (node) => {
        return await axios.post(`${node}/add`, formData, {
          headers: {
            ...formData.getHeaders()
          },
          params: {
            'replication-min': 2,
            'replication-max': 3
          },
          timeout: 60000
        });
      });

      const cid = response.data.cid;

      // Creează metadata LDP-compatibilă
      const resourceMetadata = {
        cid,
        name: file.name,
        size: file.size,
        mimeType: file.mimetype,
        containerPath,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        ...metadata,
        
        // LDP Resource type
        ldpType: 'ldp:Resource',
        
        // RDF metadata (pentru compatibilitate Solid)
        rdfMetadata: {
          'dcterms:title': file.name,
          'dcterms:created': new Date().toISOString(),
          'dcterms:format': file.mimetype,
          'stat:size': file.size
        }
      };

      console.log(`[SOLID-IPFS] Uploaded file to POD: ${file.name} -> ${cid}`);

      return {
        success: true,
        cid,
        metadata: resourceMetadata
      };
    } catch (error) {
      console.error(`[SOLID-IPFS] Error uploading file to POD:`, error.message);
      throw error;
    }
  }

  /**
   * Citește fișier din POD
   * 
   * @param {string} cid - CID fișier
   * @returns {Promise<Buffer>} Conținut fișier
   */
  async readFileFromPod(cid) {
    try {
      const response = await this.clusterClient.executeWithRetry(async (node) => {
        return await axios.get(`${node}/ipfs/${cid}`, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
      });

      console.log(`[SOLID-IPFS] Read file from POD: ${cid}`);
      return Buffer.from(response.data);
    } catch (error) {
      console.error(`[SOLID-IPFS] Error reading file from POD:`, error.message);
      throw error;
    }
  }

  /**
   * Listează fișiere dintr-un container
   * Simulează structura unui director LDP
   * 
   * @param {Array} resources - Lista de resurse (CID-uri)
   * @returns {Promise<Array>} Lista formatată pentru LDP
   */
  async listContainerResources(resources) {
    try {
      const ldpResources = resources.map(resource => ({
        '@id': resource.cid,
        '@type': 'ldp:Resource',
        'dcterms:title': resource.name,
        'dcterms:created': resource.created,
        'dcterms:modified': resource.modified,
        'stat:size': resource.size,
        'dcterms:format': resource.mimeType
      }));

      return {
        '@context': {
          'ldp': 'http://www.w3.org/ns/ldp#',
          'dcterms': 'http://purl.org/dc/terms/',
          'stat': 'http://www.w3.org/ns/posix/stat#'
        },
        '@id': '',
        '@type': 'ldp:Container',
        'ldp:contains': ldpResources
      };
    } catch (error) {
      console.error(`[SOLID-IPFS] Error listing container resources:`, error.message);
      throw error;
    }
  }

  /**
   * Creează ACL (Access Control List) document
   * ACL-urile controlează cine poate accesa ce resurse în POD
   * 
   * @param {Object} aclData - Date ACL
   * @returns {string} Document ACL în format Turtle
   */
  createACLDocument(aclData) {
    const { resourcePath, owner, readers = [], writers = [], public: isPublic = false } = aclData;

    let acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

# Access Control List for ${resourcePath}

`;

    // Owner authorization (full control)
    acl += `<#owner>
    a acl:Authorization;
    acl:agent <${owner}>;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read, acl:Write, acl:Control.

`;

    // Public access if enabled
    if (isPublic) {
      acl += `<#public>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read.

`;
    }

    // Readers
    readers.forEach((reader, index) => {
      acl += `<#reader${index}>
    a acl:Authorization;
    acl:agent <${reader}>;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read.

`;
    });

    // Writers
    writers.forEach((writer, index) => {
      acl += `<#writer${index}>
    a acl:Authorization;
    acl:agent <${writer}>;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read, acl:Write.

`;
    });

    return acl;
  }

  /**
   * Upload ACL document pe IPFS
   * 
   * @param {Object} aclData - Date ACL
   * @returns {Promise<string>} CID ACL document
   */
  async uploadACL(aclData) {
    try {
      const aclDocument = this.createACLDocument(aclData);
      const cid = await this.uploadDocument(aclDocument, '.acl');
      
      console.log(`[SOLID-IPFS] Uploaded ACL document: ${cid}`);
      return cid;
    } catch (error) {
      console.error(`[SOLID-IPFS] Error uploading ACL:`, error.message);
      throw error;
    }
  }

  /**
   * Verifică integritatea unui POD
   * 
   * @param {Object} pod - Date POD
   * @returns {Promise<Object>} Status integritate
   */
  async verifyPodIntegrity(pod) {
    const checks = {
      profile: false,
      public: false,
      private: false,
      inbox: false,
      settings: false
    };

    try {
      for (const [container, data] of Object.entries(pod.containers)) {
        if (data.cid) {
          // Verifică dacă CID-ul este accesibil
          try {
            await this.clusterClient.get(`/pins/${data.cid}`);
            checks[container] = true;
          } catch (error) {
            console.warn(`[SOLID-IPFS] Container ${container} not accessible: ${error.message}`);
          }
        }
      }

      const allValid = Object.values(checks).every(v => v);

      return {
        valid: allValid,
        checks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[SOLID-IPFS] Error verifying POD integrity:`, error.message);
      return {
        valid: false,
        checks,
        error: error.message
      };
    }
  }
}

module.exports = SolidIPFSAdapter;
