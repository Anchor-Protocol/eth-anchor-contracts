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
import {
  HOUR_PERIOD,
  HOUR_YIELD_15,
  HOUR_YIELD_20,
} from "../utils/TypeExchangeRateFeeder";

chai.use(solidity);

describe("ConversionPool", async () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let operator: SignerWithAddress;

  before("setup", async () => {
    [owner, operator] = await ethers.getSigners();
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

  // exchange
  let uniFactory: Contract;
  let uniRouter: Contract;

  // tokens
  let ust: Contract;
  let dai: Contract;
  let aust: Contract;
  let adai: Contract;

  // core
  let store: Contract;
  let router: Contract;
  let factory: Contract;

  // exts
  let pool: Contract;
  let feeder: Contract;
  let swapper: Contract;

  const EMPTY_HASH =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const SIZE = 20;
  const LIQUIDITY = constants.WeiPerEther.mul(100000);

  beforeEach("deploy contracts", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    ust = await TestAsset.connect(owner).deploy();
    dai = await TestAsset.connect(owner).deploy();
    aust = await TestAsset.connect(owner).deploy();

    // uniswap
    uniFactory = await UniFactory.connect(owner).deploy(constants.AddressZero);
    uniRouter = await UniRouter.connect(owner).deploy(
      uniFactory.address,
      constants.AddressZero // no weth
    );
    for await (const token of [ust, dai]) {
      await token.connect(owner).mint(owner.address, LIQUIDITY);
      await token.connect(owner).approve(uniRouter.address, LIQUIDITY);
    }
    await uniRouter
      .connect(owner)
      .addLiquidity(
        ust.address,
        dai.address,
        LIQUIDITY,
        LIQUIDITY,
        0,
        0,
        owner.address,
        (await latestBlocktime(provider)) + 60
      );

    // core
    const Store = await ethers.getContractFactory("OperationStore");
    const Router = await ethers.getContractFactory("Router");
    const Factory = await ethers.getContractFactory("OperationFactory");

    store = await Store.connect(owner).deploy();
    router = await Router.connect(owner).deploy();
    factory = await Factory.connect(owner).deploy();

    await store.connect(owner).transferOperator(router.address);
    await factory.connect(owner).transferOperator(router.address);
    await router
      .connect(owner)
      .initialize(store.address, 0, ust.address, aust.address, factory.address);

    // standard operation
    const Operation = await ethers.getContractFactory("Operation");
    const operation = await Operation.connect(owner).deploy();
    await operation
      .connect(owner)
      .initialize(
        encodeParameters(
          ["address", "bytes32", "address", "address"],
          [router.address, EMPTY_HASH, ust.address, aust.address]
        )
      );
    await factory.connect(owner).setStandardOperation(0, operation.address);

    // extensions
    const Pool = await ethers.getContractFactory("ConversionPool");
    const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");

    pool = await Pool.connect(owner).deploy();
    feeder = await Feeder.connect(owner).deploy();

    await feeder
      .connect(owner)
      .addToken(ust.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_20);
    await feeder
      .connect(owner)
      .addToken(dai.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_15);

    await pool
      .connect(owner)
      .initialize(
        "Anchor DAI Token",
        "aDAI",
        dai.address,
        ust.address,
        aust.address,
        router.address,
        uniFactory.address,
        feeder.address
      );

    adai = await ethers.getContractAt(
      "ERC20Controlled",
      await pool.outputToken()
    );
  });

  describe("after start", () => {
    beforeEach("start", async () => {
      await feeder.connect(owner).startUpdate([ust.address, dai.address]);

      let addrs = [];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 10; j++) {
          addrs[i * 10 + j] = `${EMPTY_HASH.slice(
            0,
            EMPTY_HASH.length - 2
          )}${i}${j}`;
        }
      }
      await factory.connect(owner).pushTerraAddresses(addrs);
    });

    const amount = constants.WeiPerEther.mul(20);

    it("works well with allocated operation", async () => {
      // allocation
      await router.connect(owner).allocate(SIZE);

      await dai.connect(owner).mint(operator.address, amount);
      await dai.connect(operator).approve(pool.address, amount);
      await pool.connect(operator).deposit(amount);
      console.log(utils.formatEther(await adai.balanceOf(operator.address)));

      await aust.connect(owner).mint(pool.address, amount);
      const aDAIAmount = await adai.balanceOf(operator.address);
      await adai.connect(operator).approve(pool.address, aDAIAmount);
      await pool.connect(operator).redeem(aDAIAmount);
    });

    it("works well with deploy new operation", async () => {
      await dai.connect(owner).mint(operator.address, amount);
      await dai.connect(operator).approve(pool.address, amount);
      await pool.connect(operator).deposit(amount);
      console.log(utils.formatEther(await adai.balanceOf(operator.address)));

      await aust.connect(owner).mint(pool.address, amount);
      const aDAIAmount = await adai.balanceOf(operator.address);
      await adai.connect(operator).approve(pool.address, aDAIAmount);
      await pool.connect(operator).redeem(aDAIAmount);
    });
  });
});
