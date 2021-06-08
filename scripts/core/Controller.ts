import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

const { provider } = ethers;

export async function deployController(
  owner: SignerWithAddress,
  admin: SignerWithAddress
): Promise<[Contract, Contract]> {
  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const Controller = await ethers.getContractFactory("Controller");

  let tx;

  // Implementation
  const impl = await Controller.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = impl);
  console.log(`controller.deploy ${impl.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  // Proxy
  const proxy = await Proxy.connect(admin).deploy(impl.address, { gasPrice });
  ({ deployTransaction: tx } = proxy);
  console.log(`controllerProxy.deploy ${proxy.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  const controller = await Controller.attach(proxy.address);

  return [impl, controller];
}
