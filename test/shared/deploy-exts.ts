import { BigNumber, constants, Contract, ContractFactory } from "ethers";
import { ethers } from "hardhat";

import UniFactoryMeta from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniRouterMeta from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

import {
  HOUR_PERIOD,
  HOUR_YIELD_15,
  HOUR_YIELD_20,
} from "../utils/TypeExchangeRateFeeder";
import { latestBlocktime } from "./utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const LIQUIDITY = constants.WeiPerEther.mul(100000);

const UniFactory = new ContractFactory(
  UniFactoryMeta.abi,
  UniFactoryMeta.bytecode
);
const UniRouter = new ContractFactory(
  UniRouterMeta.abi,
  UniRouterMeta.bytecode
);

export type Uniswap = {
  router: Contract;
  factory: Contract;
};

export type Contracts = {
  [symbol: string]: {
    token: Contract;
    poolImpl: Contract;
    pool: Contract;
  };
};

export async function deployExts(
  router: Contract,
  wUST: Contract,
  aUST: Contract,
  tokenSymbols: string[]
): Promise<{ uniswap: Uniswap; contracts: Contracts }> {
  const { provider } = ethers;
  const [admin, owner] = await ethers.getSigners();
  const TestAsset = await ethers.getContractFactory("TestAsset");

  const tokens: { [symbol: string]: Contract } = {};
  for await (const symbol of tokenSymbols) {
    tokens[symbol] = await TestAsset.connect(owner).deploy();
  }

  // uniswap
  const uniFactory = await UniFactory.connect(owner).deploy(
    constants.AddressZero
  );
  const uniRouter = await UniRouter.connect(owner).deploy(
    uniFactory.address,
    constants.AddressZero // no weth
  );

  await wUST
    .connect(owner)
    .mint(owner.address, LIQUIDITY.mul(Object.values(tokens).length));
  await wUST
    .connect(owner)
    .approve(uniRouter.address, LIQUIDITY.mul(Object.values(tokens).length));
  for await (const token of Object.values(tokens)) {
    await token.connect(owner).mint(owner.address, LIQUIDITY);
    await token.connect(owner).approve(uniRouter.address, LIQUIDITY);
    await uniRouter
      .connect(owner)
      .addLiquidity(
        wUST.address,
        token.address,
        LIQUIDITY,
        LIQUIDITY,
        0,
        0,
        owner.address,
        (await latestBlocktime(provider)) + 60
      );
  }

  const Proxy = await ethers.getContractFactory("SimpleProxy");

  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const feeder = await Feeder.connect(owner).deploy();

  await feeder
    .connect(owner)
    .addToken(wUST.address, constants.WeiPerEther, HOUR_PERIOD, HOUR_YIELD_20);

  for await (const token of Object.values(tokens)) {
    await feeder
      .connect(owner)
      .addToken(
        token.address,
        constants.WeiPerEther,
        HOUR_PERIOD,
        HOUR_YIELD_15
      );
  }

  const Swapper = await ethers.getContractFactory("UniswapSwapper");
  const swapper = await Swapper.connect(owner).deploy();
  await swapper.connect(owner).setSwapFactory(uniFactory.address);

  const Pool = await ethers.getContractFactory("ConversionPool");
  const pools: {
    [symbol: string]: {
      impl: Contract;
      proxy: Contract;
    };
  } = {};
  for await (const [symbol, token] of Object.entries(tokens)) {
    const poolImpl = await Pool.connect(owner).deploy();
    const poolProxy = await Proxy.connect(admin).deploy(poolImpl.address);
    const pool = await Pool.attach(poolProxy.address);

    await pool
      .connect(owner)
      .initialize(
        `Anchor ${symbol} Token`,
        `a${symbol}`,
        token.address,
        wUST.address,
        aUST.address,
        router.address,
        swapper.address,
        feeder.address
      );

    pools[symbol] = { impl: poolImpl, proxy: pool };
  }

  const contracts = tokenSymbols.reduce((acc, symbol) => {
    acc[symbol] = {
      token: tokens[symbol],
      poolImpl: pools[symbol].impl,
      pool: pools[symbol].proxy,
    };
    return acc;
  }, {} as Contracts);

  return {
    uniswap: {
      router: uniRouter,
      factory: uniFactory,
    },
    contracts,
  };
}
