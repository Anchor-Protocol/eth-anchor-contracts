// ============ Factory Contracts ============

// Factory Contract
const EthAnchorFactory = artifacts.require('EthAnchorFactory')

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

    await deployer.deploy(EthAnchorFactory, MockUST.address, AnchorUST.address);
  }

  if (network == 'ropsten') {
    await deployer.deploy(EthAnchorFactory, "0x6cA13a4ab78dd7D657226b155873A04DB929A3A4", "0xDAdC10D2dAC9E111835d4423670573Ae45714e7C") // using ropsten mnt address for aust
    
  }

  if (network == 'mainnet') {
    await deployer.deploy(EthAnchorFactory, "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD", "0x09a3EcAFa817268f77BE1283176B946C4ff2E608") // using mainnet mnt address for aust
    
  }
}