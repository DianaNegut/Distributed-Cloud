/**
 * Decentralized Identity Management (DID)
 * 
 * Implementează Self-Sovereign Identity bazat pe blockchain
 * - Generare și management DID-uri
 * - Credential issuance și verification
 * - On-chain proof of identity
 * - Revocation registry
 */

const crypto = require('crypto');
const BlockchainService = require('../utils/blockchain');
const ethers = require('ethers');

class DecentralizedIdentity {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1');

    // Private key pentru blockchain operations (din .env)
    this.signer = null;
    if (process.env.ETHEREUM_PRIVATE_KEY) {
      this.signer = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY, this.provider);
      console.log('[DID] Signer initialized:', this.signer.address);
    }
  }

  /**
   * Generează DID unic (off-chain)
   */
  generateDID(userId, ethereumAddress = null) {
    if (!ethereumAddress) {
      const randomWallet = ethers.Wallet.createRandom();
      ethereumAddress = randomWallet.address;
    }
    const didFragment = crypto.randomBytes(16).toString('hex');
    const did = `did:ethereum:${ethereumAddress}#${didFragment}`;
    return { did, ethereumAddress, userId };
  }

  /**
   * Înregistrează DID pe Blockchain (Real)
   */
  async registerDIDOnChain(did, docCID) {
    try {
      const contract = BlockchainService.getDIDRegistry();
      const didFragment = did.split('#')[1];

      console.log(`[DID] Registering on-chain: ${did} -> ${docCID}`);
      const tx = await contract.registerDID(didFragment, docCID);
      console.log('[DID] Transaction sent:', tx.hash);
      await tx.wait(); // Așteaptă confirmarea

      return {
        success: true,
        txHash: tx.hash,
        message: 'DID registered on Filecoin Calibration'
      };
    } catch (error) {
      console.error('[DID] On-chain registration failed:', error.message);
      throw error;
    }
  }

  /**
   * Rezolvă DID direct din Blockchain
   */
  async resolveDID(ethereumAddress) {
    try {
      const contract = BlockchainService.getDIDRegistry();
      const [did, docCID, active] = await contract.resolveDID(ethereumAddress);

      if (!active) {
        throw new Error('DID not active or not found');
      }

      return { did, docCID, active };
    } catch (error) {
      console.error('[DID] Resolution failed:', error.message);
      throw error;
    }
  }

  /**
   * (Simulat/Local) Emitere Verifiable Credential 
   * Nota: In realitate emiterea este off-chain (semnata cryptografic), 
   * doar DID-ul issuer-ului trebuie sa fie on-chain.
   */
  issuanceCredential(credentialData) {
    const { did, claims, expiresIn = 365 } = credentialData;
    const credentialId = `cred-${Date.now()}`;

    // Simplificat pentru demo:
    const credential = {
      id: credentialId,
      issuer: did,
      claims,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn * 86400000).toISOString(),
      proof: {
        type: 'EcdsaSecp256k1Signature2019',
        created: new Date().toISOString(),
        // In realitate, semnezi hash-ul credentialului cu cheia privata a DID-ului
        jws: 'simulated_signature_xyz'
      }
    };
    console.log(`[DID] Issued credential off-chain: ${credentialId}`);
    return credential;
  }
}

module.exports = new DecentralizedIdentity();
