import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { encodeParameters } from "../../test/shared/utilities";
import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

const { provider } = ethers;

export async function deployOperationFactory(
  owner: SignerWithAddress,
  router: Contract,
  controller: Contract
): Promise<Contract> {
  const OperationFactory = await ethers.getContractFactory("OperationFactory");

  let tx;

  const factory = await OperationFactory.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = factory);
  console.log(`factory.deploy ${factory.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await factory
    .connect(owner)
    .transferRouter(router.address, { gasPrice });
  console.log(`factory.transferRouter ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await factory
    .connect(owner)
    .transferController(controller.address, { gasPrice });
  console.log(`factory.transferController ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  return factory;
}

export async function deployStandardOperation(
  owner: SignerWithAddress,
  router: Contract,
  controller: Contract,
  wUSTAddr: string,
  aUSTAddr: string
): Promise<Contract> {
  const Operation = await ethers.getContractFactory("Operation");

  let tx;

  const stdOpt = await Operation.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = stdOpt);
  console.log(`stdOperation.deploy ${stdOpt.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await stdOpt
    .connect(owner)
    .initialize(
      encodeParameters(
        ["address", "address", "bytes32", "address", "address"],
        [
          router.address,
          controller.address,
          "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
          wUSTAddr,
          aUSTAddr,
        ]
      ),
      { gasPrice }
    );
  console.log(`operation.initialize ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  return stdOpt;
}
