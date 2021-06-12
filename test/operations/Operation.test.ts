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

import UniFactoryMeta from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniRouterMeta from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

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
    "swapper",
    "swapDest",
  ];

  let owner: SignerWithAddress;
  let controller: SignerWithAddress;

  before("setup", async () => {
    [owner, controller] = await ethers.getSigners();
  });

  // factories
  const UniFactory = new ContractFactory(
    UniFactoryMeta.abi,
    UniFactoryMeta.bytecode
  );
  const UniRouter = new ContractFactory(
    UniRouterMeta.abi,
    UniRouterMeta.bytecode
  );

  let uniFactory: Contract;
  let uniRouter: Contract;

  let dai: Contract;
  let wUST: Contract;
  let aUST: Contract;

  let swapper: Contract;
  let operation: Contract;

  const hash1 =
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const hash2 =
    "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";
  const LIQUIDITY = constants.WeiPerEther.mul(100000);

  beforeEach("deploy contract", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    dai = await TestAsset.connect(owner).deploy();
    wUST = await TestAsset.connect(owner).deploy();
    aUST = await TestAsset.connect(owner).deploy();

    uniFactory = await UniFactory.connect(owner).deploy(constants.AddressZero);
    uniRouter = await UniRouter.connect(owner).deploy(
      uniFactory.address,
      constants.AddressZero
    );
    for await (const token of [dai, wUST]) {
      await token.connect(owner).mint(owner.address, LIQUIDITY);
      await token.connect(owner).approve(uniRouter.address, LIQUIDITY);
    }
    await uniRouter
      .connect(owner)
      .addLiquidity(
        wUST.address,
        dai.address,
        LIQUIDITY,
        LIQUIDITY,
        0,
        0,
        owner.address,
        (await latestBlocktime(provider)) + 60
      );

    const Operation = await ethers.getContractFactory("Operation");
    operation = await Operation.connect(owner).deploy();
    await operation
      .connect(owner)
      .initialize(
        encodeParameters(
          ["address", "address", "bytes32", "address", "address"],
          [
            controller.address,
            controller.address,
            hash1,
            wUST.address,
            aUST.address,
          ]
        )
      );

    for await (const token of [wUST, aUST]) {
      await token.connect(owner).mint(owner.address, amount);
      await token.connect(owner).mint(controller.address, amount);
      await token.connect(controller).approve(operation.address, amount);
    }

    const Swapper = await ethers.getContractFactory("UniswapSwapper");
    swapper = await Swapper.connect(owner).deploy();

    await swapper.connect(owner).setSwapFactory(uniFactory.address);
  });

  it("initialize", async () => {
    expect(
      await operation.initPayload(controller.address, controller.address, hash2)
    ).to.eq(
      encodeParameters(
        ["address", "address", "bytes32", "address", "address"],
        [
          controller.address,
          controller.address,
          hash2,
          wUST.address,
          aUST.address,
        ]
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
        swapper: ZERO_ADDR,
        swapDest: ZERO_ADDR,
      });
    }

    beforeEach("check neutral", checkNeutral);
    afterEach("check neutral", checkNeutral);

    it("deposit stable", async () => {
      // ========================= INIT
      await expect(
        operation
          .connect(controller)
          .initDepositStable(
            controller.address,
            amount,
            ZERO_ADDR,
            ZERO_ADDR,
            true
          )
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
        swapper: ZERO_ADDR,
        swapDest: ZERO_ADDR,
      });

      expect(await wUST.balanceOf(controller.address)).to.eq(0);
      expect(await wUST.balanceOf(owner.address)).to.eq(amount.mul(2));

      // ========================= FINISH
      await aUST.connect(owner).transfer(operation.address, amount); // fulfill condition

      await expect(operation.connect(controller).functions["finish()"]())
        .to.emit(operation, "FinishDeposit")
        .withArgs(controller.address, amount);

      expect(await aUST.balanceOf(owner.address)).to.eq(0);
      expect(await aUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });

    it("redeem stable", async () => {
      await expect(
        operation
          .connect(controller)
          .initRedeemStable(
            controller.address,
            amount,
            ZERO_ADDR,
            ZERO_ADDR,
            true
          )
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
        swapper: ZERO_ADDR,
        swapDest: ZERO_ADDR,
      });

      expect(await aUST.balanceOf(controller.address)).to.eq(0);
      expect(await aUST.balanceOf(owner.address)).to.eq(amount.mul(2));

      // ========================= FINISH
      await wUST.connect(owner).transfer(operation.address, amount); // fulfill condition

      await expect(operation.connect(controller).functions["finish()"]())
        .to.emit(operation, "FinishRedemption")
        .withArgs(controller.address, amount);

      expect(await wUST.balanceOf(owner.address)).to.eq(0);
      expect(await wUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });

    it("redeem stable with conversion", async () => {
      await expect(
        operation
          .connect(controller)
          .initRedeemStable(
            controller.address,
            amount,
            swapper.address,
            dai.address,
            true
          )
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
        swapper: swapper.address,
        swapDest: dai.address,
      });

      expect(await aUST.balanceOf(controller.address)).to.eq(0);
      expect(await aUST.balanceOf(owner.address)).to.eq(amount.mul(2));

      // ========================= FINISH
      await wUST.connect(owner).transfer(operation.address, amount); // fulfill condition

      await expect(operation.connect(controller).functions["finish()"]())
        .to.emit(operation, "FinishRedemption")
        .withArgs(controller.address, amount);

      expect(await wUST.balanceOf(owner.address)).to.eq(0);
      expect(await wUST.balanceOf(controller.address)).to.eq(ETH.mul(10));
      console.log(utils.formatEther(await dai.balanceOf(controller.address)));
    });

    it("fail / recover", async () => {
      let currentStatus;

      // ============================= 0 -> 2 -> 0

      await wUST.connect(controller).transfer(operation.address, amount);
      await expect(
        operation
          .connect(controller)
          .functions["emergencyWithdraw(address,address)"](
            wUST.address,
            controller.address
          )
      ).to.revertedWith("Operation: not an emergency");

      await operation.connect(controller).halt();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(2);

      await operation
        .connect(controller)
        .functions["emergencyWithdraw(address,address)"](
          wUST.address,
          controller.address
        );
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
        .initDepositStable(
          controller.address,
          amount,
          ZERO_ADDR,
          ZERO_ADDR,
          true
        );
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
          .functions["emergencyWithdraw(address,address)"](
            aUST.address,
            controller.address
          )
      ).to.revertedWith("Operation: withdrawal rejected");

      await operation
        .connect(controller)
        .functions["emergencyWithdraw(address,address)"](
          wUST.address,
          controller.address
        );
      expect(await wUST.balanceOf(controller.address)).to.eq(amount);

      await aUST.connect(owner).transfer(operation.address, amount);
      await operation.connect(controller).recover();

      currentStatus = await filterStructFields(
        operationInfoFields,
        operation.getCurrentStatus()
      );
      expect(currentStatus.status).to.eq(1);

      await operation.connect(controller).functions["finish()"]();
      expect(await aUST.balanceOf(controller.address)).to.eq(amount.mul(2));
    });
  });
});
