import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network, run } from "hardhat";

import UniFactoryMeta from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniRouterMeta from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { constants, Contract, ContractFactory } from "ethers";

import { latestBlocktime } from "../test/shared/utilities";
import { Contracts } from "./contracts";

const { provider } = ethers;

const LIQUIDITY = constants.WeiPerEther.mul(10000);

export async function deployExternalContracts(
  deployer: SignerWithAddress
): Promise<Contracts> {
  const MockAsset = await ethers.getContractFactory("MockAsset");

  const tokenInfos = [
    { name: "Test TerraUSD", symbol: "UST" },
    { name: "Test AnchorUST", symbol: "aUST" },
    { name: "Test DAI", symbol: "DAI" },
    { name: "Test USDT", symbol: "USDT" },
    { name: "Test USDC", symbol: "USDC" },
    { name: "Test BUSD", symbol: "BUSD" },
  ];
  const tokens: { [symbol: string]: Contract } = {};
  for await (const { name, symbol } of tokenInfos) {
    console.log(name, symbol);
    const token = await MockAsset.connect(deployer).deploy(name, symbol);
    await token.connect(deployer).mint(deployer.address, LIQUIDITY);
    tokens[symbol] = token;
  }

  // factories
  const UniFactory = new ContractFactory(
    UniFactoryMeta.abi,
    UniFactoryMeta.bytecode
  );
  const UniRouter = new ContractFactory(
    UniRouterMeta.abi,
    UniRouterMeta.bytecode
  );

  // uniswap
  const uniFactory = await UniFactory.connect(deployer).deploy(
    constants.AddressZero
  );
  const uniRouter = await UniRouter.connect(deployer).deploy(
    uniFactory.address,
    constants.AddressZero
  );

  for await (const symbol of ["DAI", "USDT", "USDC"]) {
    const wUST = tokens["UST"];
    const extToken = tokens[symbol];
    for (const token of [wUST, extToken]) {
      await token.connect(deployer).mint(deployer.address, LIQUIDITY);
      await token
        .connect(deployer)
        .increaseAllowance(uniRouter.address, LIQUIDITY);
    }
    await uniRouter
      .connect(deployer)
      .addLiquidity(
        wUST.address,
        extToken.address,
        LIQUIDITY,
        LIQUIDITY,
        0,
        0,
        deployer.address,
        (await latestBlocktime(provider)) + 60
      );
  }

  const tokenAddrs = Object.entries(tokens).reduce(
    (acc, [symbol, contract]) => {
      acc[symbol] = contract.address;
      return acc;
    },
    {} as { [symbol: string]: string }
  );

  return {
    // uniswap
    UniRouter: uniRouter.address,
    UniFactory: uniFactory.address,

    // tokens
    ...tokenAddrs,
  };
}

export function isLocalNetwork(): boolean {
  return ["local", "hardhat", "localhost", "mainnet_fork"].includes(
    network.name
  );
}

export async function verify(
  addr: string,
  args: string[] = [],
  contract?: string
): Promise<void> {
  let taskArgs: any = {
    address: addr,
    constructorArguments: args,
  };
  if (contract) {
    taskArgs.contract = contract;
  }
  await run("verify:verify", taskArgs);
}
