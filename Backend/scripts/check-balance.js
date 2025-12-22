const ethers = require('ethers');
require('dotenv').config();

async function main() {
    const rpcUrl = process.env.FILECOIN_RPC_URL || 'https://api.calibration.node.glif.io/rpc/v1';
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
    if (!privateKey) {
        console.error("No private key found in .env");
        return;
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Checking balance for address: ${wallet.address}`);

    try {
        const balance = await provider.getBalance(wallet.address);
        console.log(`Balance: ${ethers.formatEther(balance)} FIL`);

        if (balance === 0n) {
            console.error("ERROR: Wallet has 0 FIL. You MUST fund it via Faucet.");
        } else {
            console.log("Wallet is funded.");
        }
    } catch (error) {
        console.error("Error checking balance:", error.message);
    }
}

main();
