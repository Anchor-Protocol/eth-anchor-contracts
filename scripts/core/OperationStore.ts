import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

const { provider } = ethers;

export async function deployOperationStore(
  owner: SignerWithAddress,
  router: Contract,
  controller: Contract
): Promise<Contract> {
  const OperationStore = await ethers.getContractFactory("OperationStore");

  let tx;

  const store = await OperationStore.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = store);
  console.log(`store.deploy ${store.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await store.connect(owner).transferRouter(router.address, { gasPrice });
  console.log(`store.transferRouter ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await store
    .connect(owner)
    .transferController(controller.address, { gasPrice });
  console.log(`store.transferController ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  return store;
}
