import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, Contracts, GAS_PRICE as gasPrice } from "../contracts";
import { verify } from "../utils";

const { provider } = ethers;

export interface CurveSwapperRoute {
  from: string;
  to: string;
  crv: {
    pool: string;
    bridge: string;
    indexes: [number, number];
  }[];
}

const predefinedRoutes = (
  contracts: Contracts
): { [symbol: string]: CurveSwapperRoute } => ({
  // DAI
  DAI: {
    from: contracts.DAI,
    to: contracts.UST,
    crv: [
      {
        pool: contracts.CrvUSTPool,
        bridge: contracts.DAI,
        indexes: [1, 0],
      },
    ],
  },
  // USDC
  USDC: {
    from: contracts.USDC,
    to: contracts.UST,
    crv: [
      {
        pool: contracts.CrvUSTPool,
        bridge: contracts.USDC,
        indexes: [2, 0],
      },
    ],
  },
  // USDT
  USDT: {
    from: contracts.USDT,
    to: contracts.UST,
    crv: [
      {
        pool: contracts.CrvUSTPool,
        bridge: contracts.USDT,
        indexes: [3, 0],
      },
    ],
  },
  // BUSD
  BUSD: {
    from: contracts.BUSD,
    to: contracts.UST,
    crv: [
      {
        pool: contracts.CrvBUSDPool,
        bridge: contracts.BUSD,
        indexes: [0, 2],
      },
      {
        pool: contracts.CrvUSTPool,
        bridge: contracts.USDC,
        indexes: [2, 0],
      },
    ],
  },
});

export function routeOf(
  contracts: Contracts,
  tokenSymbol: string
): CurveSwapperRoute {
  return predefinedRoutes(contracts)[tokenSymbol];
}

export type SwapperConfig = CurveSwapperConfig | UniswapSwapperConfig;

export interface CurveSwapperConfig {
  routes: CurveSwapperRoute[];
}

export async function deployCurveSwapper(
  owner: SignerWithAddress,
  config: CurveSwapperConfig
): Promise<Contract> {
  let tx;

  const Swapper = await ethers.getContractFactory("CurveSwapper");
  const swapper = await Swapper.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = swapper);
  console.log(`swapper.deploy. ${swapper.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  for await (const { from, to, crv } of config.routes) {
    const { pools, bridges, indexes } = crv.reduce(
      (acc, c) => ({
        pools: [...acc.pools, c.pool],
        bridges: [...acc.bridges, c.bridge],
        indexes: [...acc.indexes, ...c.indexes],
      }),
      { pools: [], bridges: [], indexes: [] } as {
        pools: string[];
        bridges: string[];
        indexes: number[];
      }
    );

    tx = await swapper
      .connect(owner)
      .setRoute(from, to, pools, bridges, indexes);
    console.log(`swapper.setRoute. ${swapper.address}, ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);
  }

  return swapper;
}

export interface UniswapSwapperConfig {
  uniswapFactory: string;
}

export async function deployUniswapSwapper(
  owner: SignerWithAddress,
  config: UniswapSwapperConfig
): Promise<Contract> {
  let tx;

  const UniswapSwapper = await ethers.getContractFactory("UniswapSwapper");
  const swapper = await UniswapSwapper.connect(owner).deploy();
  ({ deployTransaction: tx } = swapper);
  console.log(`swapper.deploy. ${swapper.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  tx = await swapper.connect(owner).setSwapFactory(config.uniswapFactory);
  console.log(`swapper.setSwapFactory. ${swapper.address}, ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  return swapper;
}
