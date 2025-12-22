require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.20",
    networks: {
        hardhat: {
        },
        calibration: {
            url: "https://api.calibration.node.glif.io/rpc/v1",
            accounts: process.env.ETHEREUM_PRIVATE_KEY ? [process.env.ETHEREUM_PRIVATE_KEY] : [],
            chainId: 314159,
        },
        local: {
            url: "http://127.0.0.1:8545",
        }
    },
    paths: {
        sources: "./blockchain",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
