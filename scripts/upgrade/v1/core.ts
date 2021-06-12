import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { constants, Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../../contracts";

const { provider } = ethers;

const LIQUIDITY = constants.WeiPerEther.mul(10);

export async function upgradeV1Router(
  USTAddr: string,
  aUSTAddr: string,
  router: string,
  owner: SignerWithAddress,
  admin: SignerWithAddress
): Promise<void> {
  const ERC20 = await ethers.getContractFactory("ERC20");
  const wUST = await ERC20.attach(USTAddr);
  const aUST = await ERC20.attach(aUSTAddr);

  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const proxy = await Proxy.attach(router);

  let tx;

  const Upgrader = await ethers.getContractFactory("RouterUpgraderV1");
  const upgrader = await Upgrader.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = upgrader);
  console.log(`upgrader.deploy. ${upgrader.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await aUST
    .connect(owner)
    .approve(upgrader.address, LIQUIDITY, { gasPrice });
  console.log(`aUST.approve. ${aUST.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await wUST
    .connect(owner)
    .approve(upgrader.address, LIQUIDITY, { gasPrice });
  console.log(`wUST.approve. ${wUST.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await proxy.connect(admin).changeAdmin(upgrader.address, { gasPrice });
  console.log(`proxy.changeAdmin. ${proxy.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await upgrader
    .connect(owner)
    .upgrade(proxy.address, admin.address, { gasPrice });
  console.log(`upgrader.upgrade. ${upgrader.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);
}
