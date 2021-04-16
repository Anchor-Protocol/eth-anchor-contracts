// ============ Factory Contracts ============

const { MAINNET, ROPSTEN } = require("./config");

// Factory Contract
const EthAnchorFactory = artifacts.require("EthAnchorFactory");

// MockUST Contract
const MockUST = artifacts.require("TerraUSD");
const AnchorUST = artifacts.require("AnchorUST");

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([deployFactory(deployer, network, accounts)]);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployFactory(deployer, network, [operator]) {
  if (network == "development") {
    await deployer.deploy(MockUST);
    await deployer.deploy(AnchorUST);
    console.log(`MockUST address: ${MockUST.address}`);
    console.log(`MockaUST address: ${AnchorUST.address}`);

    await deployer.deploy(EthAnchorFactory, MockUST.address, AnchorUST.address);
    const ethAnchorFactory = await EthAnchorFactory.deployed();
    await ethAnchorFactory.initialize(MockUST.address, AnchorUST.address, {
      from: operator,
    });
  }

  if (network == "ropsten") {
    await deployer.deploy(EthAnchorFactory); // using ropsten mnt address for aust
    const ethAnchorFactory = await EthAnchorFactory.deployed();
    await ethAnchorFactory.initalize(ROPSTEN.UST, ROPSTEN.aUST, {
      from: operator,
    });
  }

  if (network == "mainnet") {
    await deployer.deploy(EthAnchorFactory); // using mainnet mnt address for aust
    const ethAnchorFactory = await EthAnchorFactory.deployed();
    await ethAnchorFactory.initialize(MAINNET.UST, MAINNET.aUST, {
      from: operator,
    });
  }
}
