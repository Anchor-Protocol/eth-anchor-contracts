import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-gas-reporter";

import { Networks, EtherscanAPIKey } from "./local.config";

export default {
  default: "hardhat",
  networks: {
    hardhat: {},
    ...Networks,
  },
  solidity: {
    version: "0.7.3",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts",
  },
  etherscan: {
    apiKey: EtherscanAPIKey,
  },
  gasReporter: {
    currency: "USD",
  },
};
