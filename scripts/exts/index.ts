import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

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

  const { pool, atoken } = Object.values(pools)[0];
  if (!isLocal) {
    await verify(
      pool.address,
      [],
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
