import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, network } from "hardhat";

import UniFactoryMeta from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniRouterMeta from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { constants, ContractFactory } from "ethers";
import { latestBlocktime } from "../test/shared/utilities";

const { provider } = ethers;

export async function deployExternalContracts(
  deployer: SignerWithAddress
): Promise<{
  [name: string]: string;
}> {
  const TestAsset = await ethers.getContractFactory("TestAsset");
  const wUST = await TestAsset.connect(deployer).deploy();
  const aUST = await TestAsset.connect(deployer).deploy();
  const WETH = await TestAsset.connect(deployer).deploy();
  const DAI = await TestAsset.connect(deployer).deploy();
  const USDT = await TestAsset.connect(deployer).deploy();
  const USDC = await TestAsset.connect(deployer).deploy();

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
    constants.AddressZero // no weth
  );

  const tokens = [wUST, aUST, WETH, DAI, USDT, USDC];

  const LIQUIDITY = constants.WeiPerEther.mul(10000);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const tokenA = tokens[i];
      const tokenB = tokens[j];

      for (const token of [tokenA, tokenB]) {
        await token.connect(deployer).mint(deployer.address, LIQUIDITY);
        await token
          .connect(deployer)
          .increaseAllowance(uniRouter.address, LIQUIDITY);
      }
      await uniRouter
        .connect(deployer)
        .addLiquidity(
          tokens[i].address,
          tokens[j].address,
          LIQUIDITY,
          LIQUIDITY,
          0,
          0,
          deployer.address,
          (await latestBlocktime(provider)) + 60
        );
    }
  }

  return {
    // uniswap
    UniRouter: uniRouter.address,
    UniFactory: uniFactory.address,
    // terra
    UST: wUST.address,
    aUST: aUST.address,
    // ether
    WETH: WETH.address,
    DAI: DAI.address,
    USDT: USDT.address,
    USDC: USDC.address,
  };
}

export function isLocalNetwork(): boolean {
  return network.name !== "local" && network.name !== "hardhat";
}
