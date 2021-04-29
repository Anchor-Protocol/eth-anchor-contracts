import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
} from "ethers";
import { Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {
  advanceTimeAndBlock,
  encodeParameters,
  filterStructFields,
  latestBlocktime,
} from "../shared/utilities";

chai.use(solidity);

const ETH = utils.parseEther("1");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

describe("Operation", () => {
  const { provider } = ethers;

  const amount = ETH.mul(10);
  const operationInfoFields = [
    "status",
    "typ",
    "operator",
    "amount",
    "input",
    "output",
  ];

  let owner: SignerWithAddress;
  let controller: SignerWithAddress;

  before("setup", async () => {
    [owner, controller] = await ethers.getSigners();
  });

  let wUST: Contract;
  let aUST: Contract;
  let operation: Contract;

  const hash1 =
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const hash2 =
    "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";

  beforeEach("deploy contract", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    wUST = await TestAsset.connect(owner).deploy();
    aUST = await TestAsset.connect(owner).deploy();

    const Operation = await ethers.getContractFactory("Operation");
    operation = await Operation.connect(owner).deploy();
    await operation
      .connect(owner)
      .initialize(
        encodeParameters(
          ["address", "bytes32", "address", "address"],
          [controller.address, hash1, wUST.address, aUST.address]
        )
      );

    for await (const token of [wUST, aUST]) {
      await token.connect(owner).mint(owner.address, amount);
      await token.connect(owner).mint(controller.address, amount);
      await token.connect(controller).approve(operation.address, amount);
    }
  });

  it("initialize", async () => {
    expect(await operation.initPayload(controller.address, hash2)).to.eq(
      encodeParameters(
        ["address", "bytes32", "address", "address"],
        [controller.address, hash2, wUST.address, aUST.address]
      )
    );
  });

  describe("lifecycle", () => {
    async function checkNeutral() {
      const currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );

      expect(currentStatus).to.deep.eq({
        status: 0,
        typ: 0,
        operator: ZERO_ADDR,
        amount: BigNumber.from(0),
        input: ZERO_ADDR,
        output: ZERO_ADDR,
      });
    }

    beforeEach("check neutral", checkNeutral);
    afterEach("check neutral", checkNeutral);

    it("deposit stable", async () => {
      // ========================= INIT
      await expect(
        operation
          .connect(controller)
          .initDepositStable(controller.address, amount, true)
      )
        .to.emit(operation, "InitDeposit")
        .withArgs(controller.address, amount, hash1)
        .to.emit(operation, "AutoFinishEnabled")
        .withArgs(operation.address);

      const currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );

      expect(currentStatus).to.deep.eq({
        status: 1,
        typ: 1,
        operator: controller.address,
        amount,
        input: wUST.address,
        output: aUST.address,
      });

      expect(await wUST.balanceOf(controller.address)).to.eq(0);
      expect(await wUST.balanceOf(owner.address)).to.eq(amount.mul(2));

      // ========================= FINISH
      await aUST.connect(owner).transfer(operation.address, amount); // fulfill condition

      await expect(operation.connect(controller).finish())
        .to.emit(operation, "FinishDeposit")
        .withArgs(controller.address, amount);

      expect(await aUST.balanceOf(owner.address)).to.eq(0);
      expect(await aUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });

    it("redeem stable", async () => {
      await expect(
        operation
          .connect(controller)
          .initRedeemStable(controller.address, amount, true)
      )
        .to.emit(operation, "InitRedemption")
        .withArgs(controller.address, amount, hash1)
        .to.emit(operation, "AutoFinishEnabled")
        .withArgs(operation.address);

      const currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );

      expect(currentStatus).to.deep.eq({
        status: 1,
        typ: 2,
        operator: controller.address,
        amount,
        input: aUST.address,
        output: wUST.address,
      });

      expect(await aUST.balanceOf(controller.address)).to.eq(0);
      expect(await aUST.balanceOf(owner.address)).to.eq(amount.mul(2));

      // ========================= FINISH
      await wUST.connect(owner).transfer(operation.address, amount); // fulfill condition

      await expect(operation.connect(controller).finish())
        .to.emit(operation, "FinishRedemption")
        .withArgs(controller.address, amount);

      expect(await wUST.balanceOf(owner.address)).to.eq(0);
      expect(await wUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });

    it("fail / recover", async () => {
      let currentStatus;

      // ============================= 0 -> 2 -> 0

      await wUST.connect(controller).transfer(operation.address, amount);
      await expect(
        operation
          .connect(controller)
          .emergencyWithdraw(wUST.address, controller.address)
      ).to.revertedWith("Operation: not an emergency");

      await operation.connect(controller).halt();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(2);

      await operation
        .connect(controller)
        .emergencyWithdraw(wUST.address, controller.address);
      expect(await wUST.balanceOf(controller.address)).to.eq(amount);

      await operation.connect(controller).recover();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(0);

      // ============================= 1 -> 2 -> 1

      await operation
        .connect(controller)
        .initDepositStable(controller.address, amount, true);
      await wUST.connect(owner).transfer(operation.address, amount);
      await operation.connect(controller).halt();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(2);

      await expect(
        operation
          .connect(controller)
          .emergencyWithdraw(aUST.address, controller.address)
      ).to.revertedWith("Operation: withdrawal rejected");

      await operation
        .connect(controller)
        .emergencyWithdraw(wUST.address, controller.address);
      expect(await wUST.balanceOf(controller.address)).to.eq(amount);

      await aUST.connect(owner).transfer(operation.address, amount);
      await operation.connect(controller).recover();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(1);

      await operation.connect(controller).finish();
      expect(await aUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });
  });
});
