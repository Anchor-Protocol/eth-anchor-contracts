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

describe("ConversionPoo", async () => {
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

  beforeEach("deploy contracts", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    ust = await TestAsset.connect(owner).deploy();
    dai = await TestAsset.connect(owner).deploy();
    aust = await TestAsset.connect(owner).deploy();

    uniFactory = await UniFactory.connect(owner).deploy(constants.AddressZero);
    uniRouter = await UniRouter.connect(owner).deploy(
      uniFactory.address,
      constants.AddressZero // no weth
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
    const Swapper = await ethers.getContractFactory("UniswapProxy");

    pool = await Pool.connect(owner).deploy();
    feeder = await Feeder.connect(owner).deploy();
    swapper = await Swapper.connect(owner).deploy(uniRouter.address);

    await feeder
      .connect(owner)
      .addToken(ust.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_20);
    await feeder
      .connect(owner)
      .addToken(dai.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_15);

    await pool
      .connect(owner)
      .initialize(
        "Anchor Test Token",
        "aTNT",
        dai.address,
        ust.address,
        aust.address,
        router.address,
        swapper.address,
        feeder.address
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
      await router.connect(owner).allocate(SIZE);
    });

    it("asdf", async () => {
      expect("asdf").to.eq("asdf");
    });
  });
});
