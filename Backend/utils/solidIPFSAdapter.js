const FormData = require('form-data');
const axios = require('axios');
const path = require('path');

class SolidIPFSAdapter {
  constructor(dockerClusterClient) {
    this.clusterClient = dockerClusterClient;
  }

  // initializez cele 5 foldere solid
  async initializePodStructure(podData) {
    console.log(`[SOLID-IPFS] Initializing POD structure for ${podData.username}`);

    try {
      const profileCard = this.createProfileCard(podData);
      const profileCid = await this.uploadDocument(profileCard, 'card.ttl');

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
  // creez profile card in format rdf
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
    
    solid:storage <..>;
    
    ldp:inbox </inbox/>;
    solid:publicTypeIndex </settings/publicTypeIndex.ttl>;
    solid:privateTypeIndex </settings/privateTypeIndex.ttl>;
    
    solid:preferencesFile </settings/prefs.ttl>;
    
    solid:account "${ownerId}".
`;
  }

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
  // upload document in ipfs
  async uploadDocument(content, filename) {
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(content), {
        filename: filename,
        contentType: 'text/plain'
      });

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
  // upload fisier utilizator in ipfs
  async uploadFileToPod(file, containerPath, metadata = {}) {
    try {
      const formData = new FormData();
      formData.append('file', file.data, {
        filename: file.name,
        contentType: file.mimetype
      });
      // incarc fisierul pe mai multe noduri 
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

      const resourceMetadata = {
        cid,
        name: file.name,
        size: file.size,
        mimeType: file.mimetype,
        containerPath,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        ...metadata,

        ldpType: 'ldp:Resource',

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
  // transform lista de fisiere in format rdf
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

  createACLDocument(aclData) {
    const { resourcePath, owner, readers = [], writers = [], public: isPublic = false } = aclData;

    let acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

`;

    acl += `<#owner>
    a acl:Authorization;
    acl:agent <${owner}>;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read, acl:Write, acl:Control.

`;

    if (isPublic) {
      acl += `<#public>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read.

`;
    }

    readers.forEach((reader, index) => {
      acl += `<#reader${index}>
    a acl:Authorization;
    acl:agent <${reader}>;
    acl:accessTo <${resourcePath}>;
    acl:mode acl:Read.

`;
    });

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
