import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../../contracts";

const { provider } = ethers;

export async function upgradeV1ConversionPool(
  pool: string,
  owner: SignerWithAddress,
  admin: SignerWithAddress
): Promise<void> {
  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const proxy = await Proxy.attach(pool);

  let tx;

  const Upgrader = await ethers.getContractFactory("ConversionPoolUpgraderV1");
  const upgrader = await Upgrader.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = upgrader);
  console.log(`upgrader.deploy. ${upgrader.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await proxy.connect(admin).changeAdmin(upgrader.address, { gasPrice });
  console.log(`proxy.changeAdmin. ${proxy.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await upgrader
    .connect(owner)
    .upgrade(proxy.address, admin.address, { gasPrice });
  console.log(`upgrader.upgrade. ${upgrader.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);
}
