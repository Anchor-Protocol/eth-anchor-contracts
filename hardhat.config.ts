import '@nomiclabs/hardhat-ethers';

export default {
  default: 'hardhat',
  networks: {
    hardhat: {},
  },
  solidity: {
    version: '0.7.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './build/cache',
    artifacts: './build/artifacts',
  },
};


