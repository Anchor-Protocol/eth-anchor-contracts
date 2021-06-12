import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { Contracts } from "../contracts";
import { verify } from "../utils";
import { ConversionPool, deployConversionPools } from "./ConversionPool";
import { deployFeeder, FeederConfig } from "./ExchangeRateFeeder";
import {
  CurveSwapperConfig,
  deployCurveSwapper,
  deployUniswapSwapper,
  routeOf,
  SwapperConfig,
} from "./Swapper";

class Extensions {
  swapper!: Contract;
  feeder!: Contract;
  pools!: { [symbol: string]: ConversionPool };

  toContracts(): Contracts {
    const poolAddrs = Object.entries(this.pools).reduce((acc, [symbol, v]) => {
      acc[symbol] = {
        token: v.token.address,
        atoken: v.atoken.address,
        pool: v.pool.address,
        poolImpl: v.poolImpl.address,
      };
      return acc;
    }, {} as { [symbol: string]: any });

    return {
      swapper: this.swapper.address,
      feeder: this.feeder.address,
      ...poolAddrs,
    };
  }

  static async fromContracts(contracts: {
    [name: string]: any;
  }): Promise<Extensions> {
    const ERC20 = await ethers.getContractFactory("ERC20");
    const ConversionPool = await ethers.getContractFactory("ConversionPool");

    let pools: { [symbol: string]: any } = {};
    for await (const [symbol, poolAddrs] of Object.entries(contracts.pools)) {
      const { token, atoken, pool, poolImpl } = poolAddrs as {
        [name: string]: string;
      };
      pools[symbol] = {
        token: await ERC20.attach(token),
        atoken: await ERC20.attach(atoken),
        pool: await ConversionPool.attach(pool),
        poolImpl: poolImpl ? await ConversionPool.attach(poolImpl) : undefined,
      };
    }

    return Object.assign(new Extensions(), {
      swapper: await ethers.getContractAt("ISwapper", contracts.swapper),
      feeder: await ethers.getContractAt(
        "ExchangeRateFeeder",
        contracts.feeder
      ),
      pools,
    }) as any;
  }
}

function isCurveSwapperConfig(
  config: SwapperConfig
): config is CurveSwapperConfig {
  return (config as CurveSwapperConfig).routes !== undefined;
}

async function deployExtension(
  contracts: Contracts,
  owner: SignerWithAddress,
  admin: SignerWithAddress,
  router: Contract,
  tokens: Contract[],
  swapperConfig: SwapperConfig,
  feederConfig: FeederConfig,
  isLocal: boolean = true
): Promise<Extensions> {
  console.log(`owner: ${owner.address}`);
  console.log(`admin: ${admin.address}`);

  let swapper: Contract;
  if (isCurveSwapperConfig(swapperConfig)) {
    swapper = await deployCurveSwapper(owner, swapperConfig);
  } else {
    swapper = await deployUniswapSwapper(owner, swapperConfig);
  }
  if (!isLocal) await verify(swapper.address);

  const feeder = await deployFeeder(owner, contracts.UST, tokens, feederConfig);
  if (!isLocal) await verify(feeder.address);

  const pools = await deployConversionPools(
    contracts.UST,
    contracts.aUST,
    owner,
    admin,
    router,
    swapper,
    feeder,
    tokens
  );

  const { pool, poolImpl, atoken } = Object.values(pools)[0];
  if (!isLocal) {
    await verify(
      pool.address,
      [poolImpl.address],
      "contracts/upgradeability/SimpleProxy.sol:SimpleProxy"
    );
    await verify(atoken.address, [await atoken.name(), await atoken.symbol()]);
  }

  return Object.assign(new Extensions(), { swapper, feeder, pools });
}

export {
  // exts
  Extensions,
  deployExtension,
  // parts
  FeederConfig,
  SwapperConfig,
  routeOf,
  deployCurveSwapper,
  deployUniswapSwapper,
  deployFeeder,
  deployConversionPools,
};
