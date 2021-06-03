import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { constants, Contract } from "ethers";
import { ethers } from "hardhat";
import { encodeParameters } from "./utilities";

export type Role = {
  admin: SignerWithAddress;
  owner: SignerWithAddress;
  user: SignerWithAddress;
  bot: SignerWithAddress;
};

export type Token = {
  wUST: Contract;
  aUST: Contract;
};

export type Core = {
  store: Contract;
  factory: Contract;
  router: Contract;
  controller: Contract;
};

export const STD_OPT_ID = 0;

export const AMOUNT = constants.WeiPerEther.mul(10);
export const HASH1 =
  "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
export const HASH2 =
  "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";

export async function deployCore(): Promise<{
  role: Role;
  token: Token;
  core: Core;
}> {
  const [admin, owner, user, bot] = await ethers.getSigners();

  const Proxy = await ethers.getContractFactory("SimpleProxy");

  const TestAsset = await ethers.getContractFactory("TestAsset");
  const wUST = await TestAsset.connect(owner).deploy();
  const aUST = await TestAsset.connect(owner).deploy();

  const Store = await ethers.getContractFactory("OperationStore");
  const store = await Store.connect(owner).deploy();

  const Factory = await ethers.getContractFactory("OperationFactory");
  const factory = await Factory.connect(owner).deploy();

  const Router = await ethers.getContractFactory("Router");
  const routerImpl = await Router.connect(owner).deploy();
  const routerProxy = await Proxy.connect(admin).deploy(routerImpl.address);
  const router = await ethers.getContractAt("Router", routerProxy.address);
  await router
    .connect(owner)
    .initialize(
      store.address,
      STD_OPT_ID,
      factory.address,
      wUST.address,
      aUST.address
    );

  const Controller = await ethers.getContractFactory("Controller");
  const controllerImpl = await Controller.connect(owner).deploy();
  const controllerProxy = await Proxy.connect(admin).deploy(
    controllerImpl.address
  );
  const controller = await ethers.getContractAt(
    "Controller",
    controllerProxy.address
  );
  await controller
    .connect(owner)
    .initialize(store.address, STD_OPT_ID, factory.address);

  await store.connect(owner).transferRouter(router.address);
  await store.connect(owner).transferController(controller.address);
  await factory.connect(owner).transferRouter(router.address);
  await factory.connect(owner).transferController(controller.address);
  await controller.connect(owner).transferOperator(bot.address);

  const Operation = await ethers.getContractFactory("Operation");
  const operation = await Operation.connect(owner).deploy();
  await operation
    .connect(owner)
    .initialize(
      encodeParameters(
        ["address", "address", "bytes32", "address", "address"],
        [
          router.address,
          controller.address,
          constants.HashZero,
          wUST.address,
          aUST.address,
        ]
      )
    );

  await factory
    .connect(owner)
    .pushStandardOperation(
      router.address,
      controller.address,
      operation.address
    );

  await factory.connect(owner).pushTerraAddresses([HASH1, HASH2]);

  for await (const token of [wUST, aUST]) {
    await token.connect(owner).mint(owner.address, AMOUNT);
    await token.connect(owner).mint(user.address, AMOUNT);
    await token.connect(user).approve(router.address, AMOUNT);
  }

  return {
    role: { admin, owner, user, bot },
    token: { aUST, wUST },
    core: { store, factory, router, controller },
  };
}
