import { BigNumber, constants, Contract } from "ethers";
import { ethers, run } from "hardhat";

import { CONTRACTS } from "./contracts";

const ROUTER_ADDRESS = "0x014Bce060CBE2C9F6b16bA4A3e05217eb2D76291";

export async function deployExtension(
  router: Contract,
  tokens: Contract[],
  feederAddr?: string,
  swapperAddr?: string
) {
  const { ropsten } = CONTRACTS;
  const { provider } = ethers;

  const [operator] = await ethers.getSigners();

  const Swapper = await ethers.getContractFactory("UniswapSwapper");
  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const Pool = await ethers.getContractFactory("ConversionPool");

  const feeder = feederAddr
    ? await ethers.getContractAt("ExchangeRateFeeder", feederAddr)
    : await Feeder.connect(operator).deploy();
  console.log(`waiting ${feeder.address} ${feeder.deployTransaction.hash}`);
  await provider.waitForTransaction(feeder.deployTransaction.hash, 2);

  const swapper = swapperAddr
    ? await ethers.getContractAt("UniswapSwapper", swapperAddr)
    : await Swapper.connect(operator).deploy();
  console.log(`waiting ${swapper.address} ${swapper.deployTransaction.hash}`);
  await provider.waitForTransaction(swapper.deployTransaction.hash, 2);

  let tx;

  if (!swapperAddr) {
    tx = await swapper.connect(operator).setSwapFactory(ropsten.UniFactory);
    console.log(`waiting ${swapper.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  if (!feederAddr) {
    tx = await feeder
      .connect(operator)
      .addToken(
        ropsten.UST,
        constants.WeiPerEther,
        86400,
        BigNumber.from("1000020813179695551")
      );
    console.log(`waiting ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  for await (const token of tokens) {
    tx = await feeder
      .connect(operator)
      .addToken(
        token.address,
        constants.WeiPerEther,
        86400,
        BigNumber.from("1000015954686906531")
      );
    console.log(`waiting ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  tx = await feeder
    .connect(operator)
    .startUpdate([ropsten.UST, ...tokens.map(({ address }) => address)]);
  console.log(`waiting ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  const pools = [];
  for await (const token of tokens) {
    const symbol = await token.symbol();

    const pool = await Pool.connect(operator).deploy();
    console.log(`waiting ${pool.address} ${pool.deployTransaction.hash}`);
    await provider.waitForTransaction(pool.deployTransaction.hash, 2);

    tx = await pool
      .connect(operator)
      .initialize(
        `Anchor ${symbol} Token`,
        `a${symbol}`,
        token.address,
        ropsten.UST,
        ropsten.aUST,
        router.address,
        swapper.address,
        feeder.address
      );
    console.log(`waiting ${pool.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    pools.push({ name: symbol, addr: pool.address });
  }

  for await (const addr of [feeder.address, ...pools.map(({ addr }) => addr)]) {
    await run("verify:verify", {
      address: addr,
      constructorArguments: [],
    });
  }

  console.log({
    feeder: feeder.address,
    tokens: tokens.map(({ address }) => address),
    pools,
  });
}

async function main() {
  const Router = await ethers.getContractFactory("Router");
  const router = await ethers.getContractAt(
    "Router",
    "0x014Bce060CBE2C9F6b16bA4A3e05217eb2D76291"
  );

  const dai = await ethers.getContractAt("ERC20", CONTRACTS.ropsten.DAI);
  // await deployExtension(router, [dai]);
}

main().catch(console.error);
