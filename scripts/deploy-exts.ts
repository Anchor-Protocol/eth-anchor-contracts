import { BigNumber, Contract } from "ethers";
import { ethers, network, run } from "hardhat";

import { CONTRACTS, GAS_PRICE as gasPrice } from "./contracts";

export async function deployExtension(
  router: Contract,
  swapper: Contract,
  tokens: Contract[],
  feederAddr?: string
) {
  const contracts = CONTRACTS[network.name];
  const { provider } = ethers;

  const [operator, admin] = await ethers.getSigners();

  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const Pool = await ethers.getContractFactory("ConversionPool");
  const Proxy = await ethers.getContractFactory("SimpleProxy");

  const feeder = feederAddr
    ? await ethers.getContractAt("ExchangeRateFeeder", feederAddr)
    : await Feeder.connect(operator).deploy({ gasPrice });
  if (!feederAddr) {
    console.log(
      `exchangeRateFeeder.deploy ${feeder.address} ${feeder.deployTransaction.hash}`
    );
    await provider.waitForTransaction(feeder.deployTransaction.hash, 2);
  }

  let tx;

  if (!feederAddr) {
    tx = await feeder
      .connect(operator)
      .addToken(
        contracts.UST,
        "1042036828493072337",
        21600,
        BigNumber.from("1000113372479925668"),
        { gasPrice }
      );
    console.log(`feeder.addToken ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  for await (const token of tokens) {
    tx = await feeder
      .connect(operator)
      .addToken(
        token.address,
        "1042036828493072337",
        21600,
        BigNumber.from("1000095731939800926"),
        { gasPrice }
      );
    console.log(`feeder.addToken ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);
  }

  tx = await feeder
    .connect(operator)
    .startUpdate([contracts.UST, ...tokens.map(({ address }) => address)], {
      gasPrice,
    });
  console.log(`feeder.startUpdate ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  const pools = [];
  for await (const token of tokens) {
    const symbol = await token.symbol();

    const poolImpl = await Pool.connect(operator).deploy({ gasPrice });
    console.log(
      `pool.deploy ${poolImpl.address} ${poolImpl.deployTransaction.hash}`
    );
    await provider.waitForTransaction(poolImpl.deployTransaction.hash, 2);

    const poolProxy = await Proxy.connect(admin).deploy(poolImpl.address, {
      gasPrice,
    });
    console.log(
      `poolProxy.deploy ${poolProxy.address} ${poolProxy.deployTransaction.hash}`
    );
    await provider.waitForTransaction(poolProxy.deployTransaction.hash, 2);

    const pool = await Pool.attach(poolProxy.address);

    tx = await pool
      .connect(operator)
      .initialize(
        `Anchor ${symbol} Token`,
        `a${symbol}`,
        token.address,
        contracts.UST,
        contracts.aUST,
        router.address,
        swapper.address,
        feeder.address,
        { gasPrice }
      );
    console.log(`pool.initialize ${pool.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, 2);

    tx = await pool
      .connect(operator)
      .setExchangeRateFeeder(feeder.address, { gasPrice });
    console.log(`pool.setExchangeRateFeeder ${pool.address} ${tx.hash}`);
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
    "0xcEF9E167d3f8806771e9bac1d4a0d568c39a9388"
  );

  const swapper = await ethers.getContractAt(
    "ISwapper",
    "0xf562A9500E3d75C2908FA634525E5dE775Ee858B"
  );

  const feeder = await ethers.getContractAt(
    "ExchangeRateFeeder",
    "0xd7c4f5903De8A256a1f535AC71CeCe5750d5197a"
  );

  const contracts = CONTRACTS[network.name];
  const tokens: Contract[] = [];
  // tokens.push(await ethers.getContractAt("ERC20", contracts.DAI));
  // tokens.push(await ethers.getContractAt("ERC20", contracts.USDT));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDC));
  // tokens.push(await ethers.getContractAt("ERC20", contracts.BUSD));

  await deployExtension(router, swapper, tokens, feeder.address);
}

main().catch(console.error);
