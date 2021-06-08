import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

const { provider } = ethers;

export async function deployRouter(
  owner: SignerWithAddress,
  admin: SignerWithAddress
): Promise<[Contract, Contract]> {
  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const Router = await ethers.getContractFactory("Router");

  let tx;

  // Implementation
  const impl = await Router.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = impl);
  console.log(`router.deploy ${impl.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  // Proxy
  const proxy = await Proxy.connect(admin).deploy(impl.address, { gasPrice });
  ({ deployTransaction: tx } = proxy);
  console.log(`routerProxy.deploy ${proxy.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  const router = await Router.attach(proxy.address);

  return [impl, router];
}
