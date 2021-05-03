import { ethers, run } from "hardhat";
import { encodeParameters } from "../test/shared/utilities";
import { CONTRACTS } from "./contracts";

async function main() {
  const { provider } = ethers;

  const [operator] = await ethers.getSigners();

  const Operation = await ethers.getContractFactory("Operation");
  const OperationStore = await ethers.getContractFactory("OperationStore");
  const OperationFactory = await ethers.getContractFactory("OperationFactory");
  const Router = await ethers.getContractFactory("Router");

  const { ropsten } = CONTRACTS;

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

  tx = await factory.connect(operator).transferOperator(router.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await store.connect(operator).transferOperator(router.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await router
    .connect(operator)
    .initialize(store.address, 0, ropsten.UST, ropsten.aUST, factory.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // deploy master implementation of Operation.sol
  const stdOpt = await Operation.connect(operator).deploy();
  await provider.waitForTransaction(stdOpt.deployTransaction.hash, 2);

  tx = await stdOpt
    .connect(operator)
    .initialize(
      encodeParameters(
        ["address", "bytes32", "address", "address"],
        [
          router.address,
          "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
          ropsten.UST,
          ropsten.aUST,
        ]
      )
    );
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await factory.connect(operator).setStandardOperation(0, stdOpt.address);
  console.log(`waiting ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  for await (const addr of [
    store.address,
    factory.address,
    router.address,
    stdOpt.address,
  ]) {
    await run("verify:verify", {
      address: addr,
      constructorArguments: [],
    });
  }

  console.log({
    store: store.address,
    factory: factory.address,
    router: router.address,
  });
}

main().catch(console.error);
