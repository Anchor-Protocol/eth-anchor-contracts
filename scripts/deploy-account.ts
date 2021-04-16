import { ethers, network } from "hardhat";
import { MAINNET, ROPSTEN } from "./contracts";

const config = {
  target: "0x86d10751B18F3fE331C146546868a07224A8598B",
  purpose: "Unagii",
};

async function main() {
  const [operator] = await ethers.getSigners();

  let factoryAddr;

  switch (network.name) {
    case "mainnet":
      factoryAddr = MAINNET.FACTORY;
      break;
    case "ropsten":
      factoryAddr = ROPSTEN.FACTORY;
      break;
    default:
      throw Error(`unsupported network ${network.name}`);
  }

  const ethAnchorFactory = await ethers.getContractAt(
    "EthAnchorFactory",
    factoryAddr
  );

  const tx = await ethAnchorFactory
    .connect(operator)
    .deployContract(config.target);
  await ethers.provider.waitForTransaction(tx.hash, 3);

  const deployed = await ethAnchorFactory
    .connect(operator)
    .getContractAddress(config.target);

  console.log(`AnchorAccount for ${config.purpose} deployed. ${deployed}`);
}

main().catch(console.error);
