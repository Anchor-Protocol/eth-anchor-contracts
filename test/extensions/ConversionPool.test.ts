import chai from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { Contract, ContractFactory, utils, constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import UniFactoryMeta from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniRouterMeta from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

import { latestBlocktime } from "../shared/utilities";
import {
  HOUR_PERIOD,
  HOUR_YIELD_15,
  HOUR_YIELD_20,
} from "../utils/TypeExchangeRateFeeder";
import { deployCore } from "../shared/deploy-core";

chai.use(solidity);

describe("ConversionPool", async () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let bot: SignerWithAddress;

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
  let wUST: Contract;
  let aUST: Contract;
  let DAI: Contract;
  let aDAI: Contract;

  // core
  let store: Contract;
  let factory: Contract;
  let router: Contract;
  let controller: Contract;

  // exts
  let pool: Contract;
  let feeder: Contract;
  let swapper: Contract;

  const EMPTY_HASH =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const SIZE = 20;
  const LIQUIDITY = constants.WeiPerEther.mul(100000);

  beforeEach("deploy contracts", async () => {
    ({
      role: { owner, user, bot },
      token: { wUST, aUST },
      core: { store, factory, router, controller },
    } = await deployCore());

    const TestAsset = await ethers.getContractFactory("TestAsset");
    DAI = await TestAsset.connect(owner).deploy();

    // uniswap
    uniFactory = await UniFactory.connect(owner).deploy(constants.AddressZero);
    uniRouter = await UniRouter.connect(owner).deploy(
      uniFactory.address,
      constants.AddressZero // no weth
    );
    for await (const token of [wUST, DAI]) {
      await token.connect(owner).mint(owner.address, LIQUIDITY);
      await token.connect(owner).approve(uniRouter.address, LIQUIDITY);
    }
    await uniRouter
      .connect(owner)
      .addLiquidity(
        wUST.address,
        DAI.address,
        LIQUIDITY,
        LIQUIDITY,
        0,
        0,
        owner.address,
        (await latestBlocktime(provider)) + 60
      );

    // extensions
    const Pool = await ethers.getContractFactory("ConversionPool");
    const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
    const Swapper = await ethers.getContractFactory("UniswapSwapper");

    pool = await Pool.connect(owner).deploy();
    feeder = await Feeder.connect(owner).deploy();
    swapper = await Swapper.connect(owner).deploy();

    await feeder
      .connect(owner)
      .addToken(
        wUST.address,
        constants.WeiPerEther,
        HOUR_PERIOD,
        HOUR_YIELD_20
      );
    await feeder
      .connect(owner)
      .addToken(DAI.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_15);

    await swapper.connect(owner).setSwapFactory(uniFactory.address);

    await pool
      .connect(owner)
      .initialize(
        "Anchor DAI Token",
        "aDAI",
        DAI.address,
        wUST.address,
        aUST.address,
        router.address,
        swapper.address,
        feeder.address
      );

    aDAI = await ethers.getContractAt(
      "ERC20Controlled",
      await pool.outputToken()
    );
  });

  describe("after start", () => {
    beforeEach("start", async () => {
      await feeder.connect(owner).startUpdate([wUST.address, DAI.address]);

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
      await controller.connect(bot).allocate(SIZE);

      await DAI.connect(owner).mint(user.address, amount);
      await DAI.connect(user).approve(pool.address, amount);
      await pool.connect(user).functions["deposit(uint256)"](amount);
      console.log(utils.formatEther(await aDAI.balanceOf(user.address)));

      await aUST.connect(owner).mint(pool.address, amount);
      const aDAIAmount = await aDAI.balanceOf(user.address);
      await aDAI.connect(user).approve(pool.address, aDAIAmount);
      await pool.connect(user).functions["redeem(uint256)"](aDAIAmount);
    });

    it("works well with deploy new operation", async () => {
      await DAI.connect(owner).mint(user.address, amount);
      await DAI.connect(user).approve(pool.address, amount);
      await pool.connect(user).functions["deposit(uint256)"](amount);
      console.log(utils.formatEther(await aDAI.balanceOf(user.address)));

      await aUST.connect(owner).mint(pool.address, amount);
      const aDAIAmount = await aDAI.balanceOf(user.address);
      await aDAI.connect(user).approve(pool.address, aDAIAmount);
      await pool.connect(user).functions["redeem(uint256)"](aDAIAmount);
    });
  });
});
