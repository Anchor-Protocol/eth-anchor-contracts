import { BigNumber, Contract } from "ethers";
import { ethers, network, run } from "hardhat";

import { CONTRACTS, GAS_PRICE as gasPrice } from "./contracts";

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
    : await Feeder.connect(operator).deploy({ gasPrice });
  if (!feederAddr) {
    console.log(`waiting ${feeder.address} ${feeder.deployTransaction.hash}`);
    await provider.waitForTransaction(feeder.deployTransaction.hash, 2);
  }

  const swapper = swapperAddr
    ? await ethers.getContractAt("UniswapSwapper", swapperAddr)
    : await Swapper.connect(operator).deploy({ gasPrice });
  if (!swapperAddr) {
    console.log(`waiting ${swapper.address} ${swapper.deployTransaction.hash}`);
    await provider.waitForTransaction(swapper.deployTransaction.hash, 2);
  }

  let tx;

  if (!swapperAddr) {
    tx = await swapper
      .connect(operator)
      .setSwapFactory(ropsten.UniFactory, { gasPrice });
    console.log(`waiting ${swapper.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  if (!feederAddr) {
    tx = await feeder
      .connect(operator)
      .addToken(
        ropsten.UST,
        "1038170811442615733",
        21600,
        BigNumber.from("1000124885576180370"),
        { gasPrice }
      );
    console.log(`waiting ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  for await (const token of tokens) {
    tx = await feeder
      .connect(operator)
      .addToken(
        token.address,
        "1038170811442615733",
        21600,
        BigNumber.from("1000095731939800926"),
        { gasPrice }
      );
    console.log(`waiting ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  tx = await feeder
    .connect(operator)
    .startUpdate([ropsten.UST, ...tokens.map(({ address }) => address)], {
      gasPrice,
    });
  console.log(`waiting ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  const pools = [];
  for await (const token of tokens) {
    const symbol = await token.symbol();

    const pool = await Pool.connect(operator).deploy({ gasPrice });
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
        feeder.address,
        { gasPrice }
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
  const router = await ethers.getContractAt(
    "Router",
    "0x0d4366b32d146622bf884C53cD7Dd6a1d268d809"
  );

  const contracts = CONTRACTS[network.name];

  const tokens: Contract[] = [];
  tokens.push(await ethers.getContractAt("ERC20", contracts.DAI));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDT));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDC));
  tokens.push(await ethers.getContractAt("ERC20", contracts.BUSD));

  await deployExtension(router, tokens);
}

main().catch(console.error);
