import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Queue, Status } from "../utils/TypeOperationStore";
import { AMOUNT, deployCore, HASH1 } from "../shared/deploy-core";

chai.use(solidity);

describe("Router", () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let bot: SignerWithAddress;

  let wUST: Contract;
  let aUST: Contract;

  let store: Contract;
  let factory: Contract;
  let router: Contract;
  let controller: Contract;

  beforeEach("deploy contracts", async () => {
    ({
      role: { owner, user, bot },
      token: { aUST, wUST },
      core: { store, factory, router, controller },
    } = await deployCore());
  });

  describe("#_init", () => {
    it("should deploy new contract if theres no available operation", async () => {
      await expect(
        router.connect(user).functions["depositStable(uint256)"](AMOUNT)
      )
        .to.emit(factory, "ContractDeployed")
        .to.emit(store, "OperationAllocated")
        .to.emit(aUST, "Approval")
        .to.emit(wUST, "Approval");
    });
  });

  describe("after allocation", () => {
    let instance: Contract;

    beforeEach("allocate", async () => {
      await controller.connect(bot).allocate(1);
      instance = await ethers.getContractAt(
        "Operation",
        await store.getAvailableOperation()
      );
    });

    it("#depositStable - auto", async () => {
      await expect(
        router.connect(user).functions["depositStable(uint256)"](AMOUNT)
      )
        .to.emit(instance, "InitDeposit")
        .withArgs(user.address, AMOUNT, HASH1)
        .to.emit(instance, "AutoFinishEnabled")
        .withArgs(instance.address);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_AUTO
      );

      await aUST.connect(owner).transfer(instance.address, AMOUNT);

      await expect(controller.connect(bot).finish(instance.address))
        .to.emit(instance, "FinishDeposit")
        .withArgs(user.address, AMOUNT)
        .to.emit(store, "OperationFinished")
        .withArgs(controller.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.FINISHED);
      await expect(controller.connect(bot).flush(1))
        .to.emit(store, "OperationFlushed")
        .withArgs(
          controller.address,
          instance.address,
          Queue.RUNNING,
          Queue.IDLE
        );
    });

    it("#depositStable - manual", async () => {
      await expect(
        router.connect(user).functions["initDepositStable(uint256)"](AMOUNT)
      )
        .to.emit(instance, "InitDeposit")
        .withArgs(user.address, AMOUNT, HASH1);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_MANUAL
      );

      await aUST.connect(owner).transfer(instance.address, AMOUNT);

      await expect(router.connect(user).finish(instance.address))
        .to.emit(instance, "FinishDeposit")
        .withArgs(user.address, AMOUNT)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.IDLE);
    });

    it("#redeemStable - auto", async () => {
      await expect(
        router.connect(user).functions["redeemStable(uint256)"](AMOUNT)
      )
        .to.emit(instance, "InitRedemption")
        .withArgs(user.address, AMOUNT, HASH1)
        .to.emit(instance, "AutoFinishEnabled")
        .withArgs(instance.address);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_AUTO
      );

      await wUST.connect(owner).transfer(instance.address, AMOUNT);

      await expect(controller.connect(bot).finish(instance.address))
        .to.emit(instance, "FinishRedemption")
        .withArgs(user.address, AMOUNT)
        .to.emit(store, "OperationFinished")
        .withArgs(controller.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.FINISHED);
      await expect(controller.connect(bot).flush(1))
        .to.emit(store, "OperationFlushed")
        .withArgs(
          controller.address,
          instance.address,
          Queue.RUNNING,
          Queue.IDLE
        );
    });

    it("#redeemStable - manual", async () => {
      await expect(
        router.connect(user).functions["initRedeemStable(uint256)"](AMOUNT)
      )
        .to.emit(instance, "InitRedemption")
        .withArgs(user.address, AMOUNT, HASH1);
      expect(await store.getStatusOf(instance.address)).to.eq(
        Status.RUNNING_MANUAL
      );

      await wUST.connect(owner).transfer(instance.address, AMOUNT);

      await expect(router.connect(user).finish(instance.address))
        .to.emit(instance, "FinishRedemption")
        .withArgs(user.address, AMOUNT)
        .to.emit(store, "OperationFinished")
        .withArgs(router.address, instance.address);

      expect(await store.getStatusOf(instance.address)).to.eq(Status.IDLE);
    });
  });
});
