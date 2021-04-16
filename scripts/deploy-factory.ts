import { ethers } from "hardhat";
import { MAINNET, ROPSTEN } from "./contracts";

async function main() {
  const { provider } = ethers;
  const [operator] = await ethers.getSigners();

  const EthAnchorFactory = await ethers.getContractFactory("EthAnchorFactory");
  const ethAnchorFactory = await EthAnchorFactory.connect(operator).deploy();
  const tx = await ethAnchorFactory
    .connect(operator)
    .initialize(ROPSTEN.UST, ROPSTEN.aUST);
  console.log(`Factory deployed => ${ethAnchorFactory.address}`);
  await provider.waitForTransaction(tx.hash, 3);

  console.log(
    `TerraUSD: ${await ethAnchorFactory.connect(operator).terrausd()}`
  );
  console.log(
    `AnchorUSD: ${await ethAnchorFactory.connect(operator).anchorust()}`
  );
  return;
}

main().catch(console.error);
