import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

const { provider } = ethers;

export interface ConversionPool {
  token: Contract;
  atoken: Contract;
  pool: Contract;
  poolImpl: Contract;
}

export async function deployConversionPools(
  UST: string,
  aUST: string,
  owner: SignerWithAddress,
  admin: SignerWithAddress,
  router: Contract,
  swapper: Contract,
  feeder: Contract,
  tokens: Contract[]
): Promise<{ [symbol: string]: ConversionPool }> {
  const Pool = await ethers.getContractFactory("ConversionPool");
  const Proxy = await ethers.getContractFactory("SimpleProxy");
  const ERC20 = await ethers.getContractFactory("ERC20");

  const pools: { [symbol: string]: ConversionPool } = {};
  for await (const token of tokens) {
    let tx;
    const symbol = await token.symbol();
    console.log(`Deploying conversion pool for ${symbol}`);

    const impl = await Pool.connect(owner).deploy({ gasPrice });
    ({ deployTransaction: tx } = impl);
    console.log(`pool.deploy. ${impl.address}, ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);

    const proxy = await Proxy.connect(admin).deploy(impl.address, { gasPrice });
    ({ deployTransaction: tx } = proxy);
    console.log(`proxy.deploy. ${proxy.address}, ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);

    const pool = await Pool.attach(proxy.address);

    tx = await pool
      .connect(owner)
      .initialize(
        `Anchor ${symbol} Token`,
        `a${symbol}`,
        token.address,
        UST,
        aUST,
        router.address,
        swapper.address,
        feeder.address,
        { gasPrice }
      );
    console.log(`pool.initialize. ${pool.address}, ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);

    tx = await pool
      .connect(owner)
      .setExchangeRateFeeder(feeder.address, { gasPrice });
    console.log(`pool.setExchangeRateFeeder. ${pool.address}, ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);

    const atokenAddr = await pool.connect(owner).outputToken();
    const atoken = await ERC20.attach(atokenAddr);

    pools[symbol] = { token, atoken, pool, poolImpl: impl };
  }

  return pools;
}
