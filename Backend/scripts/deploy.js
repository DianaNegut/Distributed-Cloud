const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("Starting deployment to Filecoin Calibration...");

    // 1. Deploy DIDRegistry
    const DIDRegistry = await hre.ethers.getContractFactory("DIDRegistry");
    const didRegistry = await DIDRegistry.deploy();
    await didRegistry.waitForDeployment();
    const didAddress = await didRegistry.getAddress();
    console.log(`DIDRegistry deployed to: ${didAddress}`);

    // 2. Deploy StorageContract
    const StorageContract = await hre.ethers.getContractFactory("StorageContract");
    const storageContract = await StorageContract.deploy();
    await storageContract.waitForDeployment();
    const storageAddress = await storageContract.getAddress();
    console.log(`StorageContract deployed to: ${storageAddress}`);

    // Save addresses to .env or config
    const envPath = path.join(__dirname, "../.env");
    let envContent = "";

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
    }

    // Update or append addresses
    const updateEnv = (key, value) => {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    };

    updateEnv("DID_REGISTRY_ADDRESS", didAddress);
    updateEnv("STORAGE_CONTRACT_ADDRESS", storageAddress);

    fs.writeFileSync(envPath, envContent);
    console.log("Updated .env with new contract addresses");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
