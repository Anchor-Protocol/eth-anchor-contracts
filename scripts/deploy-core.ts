import { ethers, network, run } from "hardhat";

import { encodeParameters } from "../test/shared/utilities";
import { CONTRACTS, GAS_PRICE as gasPrice } from "./contracts";
import { deployExternalContracts, isLocalNetwork } from "./local";

async function main() {
  const { provider } = ethers;

  const [operator, admin] = await ethers.getSigners();

  console.log(`operator: ${operator.address}`);
  console.log(`admin: ${admin.address}`);

  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const Operation = await ethers.getContractFactory("Operation");
  const OperationStore = await ethers.getContractFactory("OperationStore");
  const OperationFactory = await ethers.getContractFactory("OperationFactory");
  const Router = await ethers.getContractFactory("Router");
  const Controller = await ethers.getContractFactory("Controller");

  let contracts: { [name: string]: string };
  if (!isLocalNetwork()) {
    contracts = CONTRACTS[network.name];
  } else {
    contracts = await deployExternalContracts(operator);
  }

  let tx;

  // deploy operation store
  const store = await OperationStore.connect(operator).deploy({ gasPrice });
  console.log(
    `factory.deploy ${store.address} ${store.deployTransaction.hash}`
  );
  await provider.waitForTransaction(store.deployTransaction.hash, 2);

  // deploy factory
  const factory = await OperationFactory.connect(operator).deploy({ gasPrice });
  console.log(
    `factory.deploy ${factory.address} ${factory.deployTransaction.hash}`
  );
  await provider.waitForTransaction(factory.deployTransaction.hash, 2);

  //======= Deploy router / proxy
  const routerImpl = await Router.connect(operator).deploy({ gasPrice });
  console.log(
    `router.deploy ${routerImpl.address} ${routerImpl.deployTransaction.hash}`
  );
  await provider.waitForTransaction(routerImpl.deployTransaction.hash, 2);
  const routerProxy = await Proxy.connect(admin).deploy(routerImpl.address, {
    gasPrice,
  });
  console.log(
    `routerProxy.deploy ${routerProxy.address} ${routerProxy.deployTransaction.hash}`
  );
  await provider.waitForTransaction(routerProxy.deployTransaction.hash, 2);
  const router = await ethers.getContractAt("Router", routerProxy.address);

  //======= Deploy controller / proxy
  const controllerImpl = await Controller.connect(operator).deploy({
    gasPrice,
  });
  console.log(
    `controller.deploy ${controllerImpl.address} ${controllerImpl.deployTransaction.hash}`
  );
  await provider.waitForTransaction(controllerImpl.deployTransaction.hash, 2);
  const controllerProxy = await Proxy.connect(
    admin
  ).deploy(controllerImpl.address, { gasPrice });
  console.log(
    `controllerProxy.deploy ${controllerProxy.address} ${controllerProxy.deployTransaction.hash}`
  );
  await provider.waitForTransaction(controllerProxy.deployTransaction.hash, 2);
  const controller = await ethers.getContractAt(
    "Controller",
    controllerProxy.address
  );

  // ACL setting - factory
  {
    tx = await factory
      .connect(operator)
      .transferRouter(router.address, { gasPrice });
    console.log(`factory.transferRouter ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    tx = await factory
      .connect(operator)
      .transferController(controller.address, { gasPrice });
    console.log(`factory.transferController ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  // ACL setting - store
  {
    tx = await store
      .connect(operator)
      .transferRouter(router.address, { gasPrice });
    console.log(`store.transferRouter ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    tx = await store
      .connect(operator)
      .transferController(controller.address, { gasPrice });
    console.log(`store.transferController ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  tx = await router
    .connect(operator)
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
    .connect(operator)
    .initialize(store.address, 0, factory.address, { gasPrice });
  console.log(`controller.initialize ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // deploy master implementation of Operation.sol
  const stdOpt = await Operation.connect(operator).deploy({ gasPrice });
  console.log(
    `stdOperation.deploy ${stdOpt.address} ${stdOpt.deployTransaction.hash}`
  );
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
      ),
      { gasPrice }
    );
  console.log(`operation.initialize ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await factory
    .connect(operator)
    .pushStandardOperation(router.address, controller.address, stdOpt.address, {
      gasPrice,
    });
  console.log(`factory.pushStandardOperation ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  if (!isLocalNetwork()) {
    for await (const [name, { contract, args }] of Object.entries({
      store: { contract: store, args: [] },
      factory: { contract: factory, args: [] },
      router: {
        contract: router,
        args: [routerImpl.address],
      },
      controller: {
        contract: controller,
        args: [controllerImpl.address],
      },
      stdOpt: { contract: stdOpt, args: [] },
    })) {
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: args,
      });
      console.log(`${name} => ${contract.address}`);
    }
  }
}

main().catch(console.error);
