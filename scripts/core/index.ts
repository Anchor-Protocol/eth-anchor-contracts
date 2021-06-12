import { deployController } from "./Controller";
import { deployRouter } from "./Router";
import {
  deployOperationFactory,
  deployStandardOperation,
} from "./OperationFactory";
import { deployOperationStore } from "./OperationStore";

import { Contract } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";

import { Contracts, GAS_PRICE as gasPrice } from "../contracts";
import { verify } from "../utils";

const { provider } = ethers;

class Core {
  router!: Contract;
  routerImpl!: Contract;
  controller!: Contract;
  controllerImpl!: Contract;
  factory!: Contract;
  store!: Contract;

  toContracts(): Contracts {
    return Object.entries(this).reduce((acc, [name, contract]) => {
      acc[name] = contract.address;
      return acc;
    }, {} as { [name: string]: any });
  }

  static async fromContracts(contracts: Contracts): Promise<Core> {
    return Object.assign(new Core(), {
      router: await ethers.getContractAt("Router", contracts.router),
      routerImpl: contracts.routerImpl
        ? await ethers.getContractAt("Router", contracts.routerImpl)
        : undefined,
      controller: await ethers.getContractAt(
        "Controller",
        contracts.controller
      ),
      controllerImpl: contracts.controllerImpl
        ? await ethers.getContractAt("Controller", contracts.controllerImpl)
        : undefined,
      factory: await ethers.getContractAt(
        "OperationFactory",
        contracts.factory
      ),
      store: await ethers.getContractAt("OperationStore", contracts.store),
    }) as any;
  }
}

const HASH1 =
  "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
const HASH2 =
  "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";

async function deployCore(
  contracts: Contracts,
  owner: SignerWithAddress,
  admin: SignerWithAddress,
  isLocal: boolean = true
): Promise<Core> {
  console.log(`owner: ${owner.address}`);
  console.log(`admin: ${admin.address}`);

  const [routerImpl, router] = await deployRouter(owner, admin);
  if (!isLocal)
    await verify(
      router.address,
      [routerImpl.address],
      "contracts/upgradeability/SimpleProxy.sol:SimpleProxy"
    );

  const [controllerImpl, controller] = await deployController(owner, admin);
  if (!isLocal)
    await verify(
      controller.address,
      [controllerImpl.address],
      "contracts/upgradeability/SimpleProxy.sol:SimpleProxy"
    );

  const factory = await deployOperationFactory(owner, router, controller);
  if (!isLocal) await verify(factory.address);
  else await factory.connect(owner).pushTerraAddresses([HASH1, HASH2]);

  const store = await deployOperationStore(owner, router, controller);
  if (!isLocal) await verify(store.address);

  let tx;

  tx = await router
    .connect(owner)
    .initialize(
      store.address,
      0,
      factory.address,
      contracts.UST,
      contracts.aUST,
      { gasPrice }
    );
  console.log(`router.initialize ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await controller
    .connect(owner)
    .initialize(store.address, 0, factory.address, { gasPrice });
  console.log(`controller.initialize ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // deploy master implementation of Operation.sol
  const stdOpt = await deployStandardOperation(
    owner,
    router,
    controller,
    contracts.UST,
    contracts.aUST
  );
  if (!isLocal) await verify(stdOpt.address);

  tx = await factory
    .connect(owner)
    .pushStandardOperation(router.address, controller.address, stdOpt.address, {
      gasPrice,
    });
  console.log(`factory.pushStandardOperation ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  return Object.assign(new Core(), {
    router,
    routerImpl,
    controller,
    controllerImpl,
    factory,
    store,
  });
}

export {
  // core
  Core,
  deployCore,
  // parts
  deployController,
  deployRouter,
  deployOperationFactory,
  deployStandardOperation,
  deployOperationStore,
};
