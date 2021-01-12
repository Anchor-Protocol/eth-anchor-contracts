// ============ Factory Contracts ============

// Factory Contract
const AnchorEthFactory = artifacts.require('AnchorEthFactory')

// MockUST Contract
const MockUST = artifacts.require('TerraUSD')
const AnchorUST = artifacts.require('AnchorUST')

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([deployFactory(deployer, network, accounts)])
}

module.exports = migration

// ============ Deploy Functions ============

async function deployFactory(deployer, network, accounts) {
  if (network == 'development') {
    await deployer.deploy(MockUST);
    await deployer.deploy(AnchorUST);
    console.log(`MockUST address: ${MockUST.address}`);
    console.log(`MockaUST address: ${AnchorUST.address}`);

    await deployer.deploy(AnchorEthFactory, MockUST.address, AnchorUST.address);
  }

  if (network == 'ropsten') {
    await deployer.deploy(AnchorEthFactory, "0x6cA13a4ab78dd7D657226b155873A04DB929A3A4", "0x51e7f3ED326719a1469EbD7E68B8AB963d64eBA6") // using ropsten mnt address for aust
    
  }

  if (network == 'mainnet') {
    await deployer.deploy(AnchorEthFactory, "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD", "0x156B36ec68FdBF84a925230BA96cb1Ca4c4bdE45") // using mainnet mnt address for aust
    
  }
}