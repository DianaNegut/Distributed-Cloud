const { ethers } = require("ethers");
require("dotenv").config();

// Contract ABIs
const DIDRegistryArtifact = require("../artifacts/blockchain/DIDRegistry.sol/DIDRegistry.json");
const StorageContractArtifact = require("../artifacts/blockchain/StorageContract.sol/StorageContract.json");

class BlockchainService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(
            process.env.FILECOIN_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1"
        );

        this.wallet = null;
        if (process.env.ETHEREUM_PRIVATE_KEY) {
            this.wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY, this.provider);
        }

        this.didRegistryAddress = process.env.DID_REGISTRY_ADDRESS;
        this.storageContractAddress = process.env.STORAGE_CONTRACT_ADDRESS;
    }

    getDIDRegistry() {
        if (!this.didRegistryAddress) throw new Error("DID_REGISTRY_ADDRESS not set");
        return new ethers.Contract(this.didRegistryAddress, DIDRegistryArtifact.abi, this.wallet || this.provider);
    }

    getStorageContract() {
        if (!this.storageContractAddress) throw new Error("STORAGE_CONTRACT_ADDRESS not set");
        return new ethers.Contract(this.storageContractAddress, StorageContractArtifact.abi, this.wallet || this.provider);
    }

    async getBalance(address) {
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
    }
}

module.exports = new BlockchainService();
