const {ethers, upgrades} = require("hardhat");

async function main() {
  // using @openzeppelin/hardhat-upgrades
  const AnchorEthFactory = await ethers.getContractFactory("AnchorEthFactory");
  const anchor_eth_factory = await upgrades.deployProxy(AnchorEthFactory, "constructor_arguments")

  await anchor_eth_factory.deployed();

  console.log("AnchorEthFactory deployed to:", anchor_eth_factory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
