import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
  constants,
} from "ethers";
import { Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {
  advanceTimeAndBlock,
  encodeParameters,
  filterStructFields,
  latestBlocktime,
} from "../shared/utilities";
import { Queue, Status } from "../utils/TypeOperationStore";

chai.use(solidity);

describe("Router", () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let bot: SignerWithAddress;
  let operator: SignerWithAddress;

  before("setup", async () => {
    [owner, bot, operator] = await ethers.getSigners();
  });

  let token: Contract;
  let wUST: Contract;
  let aUST: Contract;

  let store: Contract;
  let factory: Contract;
  let router: Contract;

  const STD_OPT_ID = 0;

  const amount = constants.WeiPerEther.mul(10);
  const hash1 =
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const hash2 =
    "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";

  beforeEach("deploy contracts", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    token = await TestAsset.connect(owner).deploy();
    wUST = await TestAsset.connect(owner).deploy();
    aUST = await TestAsset.connect(owner).deploy();

    const Store = await ethers.getContractFactory("OperationStore");
    store = await Store.connect(owner).deploy();

    const Factory = await ethers.getContractFactory("OperationFactory");
    factory = await Factory.connect(owner).deploy();

    const Router = await ethers.getContractFactory("Router");
    router = await Router.connect(owner).deploy();
    await router
      .connect(owner)
      .initialize(
        store.address,
        STD_OPT_ID,
        wUST.address,
        aUST.address,
        factory.address
      );

    await router.connect(owner).transferOperator(bot.address);
    await store.connect(owner).transferOperator(router.address);
    await factory.connect(owner).transferOperator(router.address);

    const Operation = await ethers.getContractFactory("Operation");
    const operation = await Operation.connect(owner).deploy();
    await operation
      .connect(owner)
      .initialize(
        encodeParameters(
          ["address", "bytes32", "address", "address"],
          [router.address, constants.HashZero, wUST.address, aUST.address]
        )
      );

    await factory
      .connect(owner)
      .setStandardOperation(STD_OPT_ID, operation.address);

    await factory.connect(owner).pushTerraAddresses([hash1, hash2]);

    for await (const t of [token, wUST, aUST]) {
      await t.connect(owner).mint(owner.address, amount);
      await t.connect(owner).mint(operator.address, amount);
      await t.connect(operator).approve(router.address, amount);
    }
  });

  describe("#_init", () => {
    it("should deploy new contract if theres no available operation", async () => {
      await expect(router.connect(operator).depositStable(amount))
        .to.emit(factory, "ContractDeployed")
        .to.emit(store, "OperationAllocated")
        .to.emit(aUST, "Approval")
        .to.emit(wUST, "Approval");
    });
  });

  describe("after allocation", () => {
    let instance: Contract;

    beforeEach("allocate", async () => {
      await router.connect(bot).allocate(1);
      instance = await ethers.getContractAt(
        "Operation",
        await store.getAvailableOperation()
      );
    });

    it("#depositStable - auto", async () => {
      await expect(router.connect(operator).depositStable(amount))
        .to.emit(instance, "InitDeposit")
        .withArgs(operator.address, amount, hash1)
        .to.emit(instance, "AutoFinishEnabled")
        .withArgs(instance.address);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_AUTO
      );

      await aUST.connect(owner).transfer(instance.address, amount);

      await expect(router.connect(operator).finish(instance.address))
        .to.emit(instance, "FinishDeposit")
        .withArgs(operator.address, amount)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.FINISHED);
      await expect(router.connect(bot).flush(1))
        .to.emit(store, "OperationFlushed")
        .withArgs(router.address, instance.address, Queue.RUNNING, Queue.IDLE);
    });

    it("#depositStable - manual", async () => {
      await expect(router.connect(operator).initDepositStable(amount))
        .to.emit(instance, "InitDeposit")
        .withArgs(operator.address, amount, hash1);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_MANUAL
      );

      await aUST.connect(owner).transfer(instance.address, amount);

      await expect(router.connect(operator).finish(instance.address))
        .to.emit(instance, "FinishDeposit")
        .withArgs(operator.address, amount)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.IDLE);
    });

    it("#redeemStable - auto", async () => {
      await expect(router.connect(operator).redeemStable(amount))
        .to.emit(instance, "InitRedemption")
        .withArgs(operator.address, amount, hash1)
        .to.emit(instance, "AutoFinishEnabled")
        .withArgs(instance.address);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_AUTO
      );

      await wUST.connect(owner).transfer(instance.address, amount);

      await expect(router.connect(operator).finish(instance.address))
        .to.emit(instance, "FinishRedemption")
        .withArgs(operator.address, amount)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.FINISHED);
      await expect(router.connect(bot).flush(1))
        .to.emit(store, "OperationFlushed")
        .withArgs(router.address, instance.address, Queue.RUNNING, Queue.IDLE);
    });

    it("#redeemStable - manual", async () => {
      await expect(router.connect(operator).initRedeemStable(amount))
        .to.emit(instance, "InitRedemption")
        .withArgs(operator.address, amount, hash1);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_MANUAL
      );

      await wUST.connect(owner).transfer(instance.address, amount);

      await expect(router.connect(operator).finish(instance.address))
        .to.emit(instance, "FinishRedemption")
        .withArgs(operator.address, amount)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.IDLE);
    });
  });
});
