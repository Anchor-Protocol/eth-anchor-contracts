import { ethers, network, run } from "hardhat";
import { encodeParameters } from "../test/shared/utilities";
import { CONTRACTS } from "./contracts";
import { deployExternalContracts, isLocalNetwork } from "./local";

async function main() {
  const { provider } = ethers;

  const [operator] = await ethers.getSigners();

  console.log(operator.address);

  const Operation = await ethers.getContractFactory("Operation");
  const OperationStore = await ethers.getContractFactory("OperationStore");
  const OperationFactory = await ethers.getContractFactory("OperationFactory");
  const Router = await ethers.getContractFactory("Router");
  const Controller = await ethers.getContractFactory("Controller");

  let contracts: { [name: string]: string };
  if (isLocalNetwork()) {
    contracts = CONTRACTS[network.name];
  } else {
    contracts = await deployExternalContracts(operator);
  }

  let tx;

  // deploy operation store
  const store = await OperationStore.connect(operator).deploy();
  console.log(`waiting ${store.address} ${store.deployTransaction.hash}`);
  await provider.waitForTransaction(store.deployTransaction.hash, 2);

  // deploy factory
  const factory = await OperationFactory.connect(operator).deploy();
  console.log(`waiting ${factory.address} ${factory.deployTransaction.hash}`);
  await provider.waitForTransaction(factory.deployTransaction.hash, 2);

  // deploy controller (router)
  const router = await Router.connect(operator).deploy();
  console.log(`waiting ${router.address} ${router.deployTransaction.hash}`);
  await provider.waitForTransaction(router.deployTransaction.hash, 2);

  const controller = await Controller.connect(operator).deploy();
  console.log(
    `waiting ${controller.address} ${controller.deployTransaction.hash}`
  );
  await provider.waitForTransaction(controller.deployTransaction.hash, 2);

  // ACL setting - factory
  {
    tx = await factory.connect(operator).transferRouter(router.address);
    console.log(`waiting ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    tx = await factory.connect(operator).transferController(controller.address);
    console.log(`waiting ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  // ACL setting - store
  {
    tx = await store.connect(operator).transferRouter(router.address);
    console.log(`waiting ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    tx = await store.connect(operator).transferController(controller.address);
    console.log(`waiting ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  tx = await router
    .connect(operator)
    .initialize(
      store.address,
      0,
      factory.address,
      contracts.UST,
      contracts.aUST
    );
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await controller
    .connect(operator)
    .initialize(store.address, 0, factory.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // deploy master implementation of Operation.sol
  const stdOpt = await Operation.connect(operator).deploy();
  await provider.waitForTransaction(stdOpt.deployTransaction.hash, 2);

  tx = await stdOpt
    .connect(operator)
    .initialize(
      encodeParameters(
        ["address", "address", "bytes32", "address", "address"],
        [
          router.address,
          controller.address,
          "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
          contracts.UST,
          contracts.aUST,
        ]
      )
    );
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await factory
    .connect(operator)
    .pushStandardOperation(router.address, controller.address, stdOpt.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  if (isLocalNetwork()) {
    for await (const [name, contract] of Object.entries({
      store,
      factory,
      router,
      controller,
      stdOpt,
    })) {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: [],
      });
      console.log(`${name} => ${contract.address}`);
    }
  }
}

main().catch(console.error);
