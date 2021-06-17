import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";
import { ConversionPool } from "./ConversionPool";

const { provider } = ethers;

export interface FeederConfig {
  baseRate: BigNumber;
  period: number;
  wUSTWeight: BigNumber;
  extTokenWeight: BigNumber;
}

export async function deployFeeder(
  owner: SignerWithAddress,
  UST: string,
  tokens: Contract[],
  config: FeederConfig
): Promise<Contract> {
  let tx;

  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const feeder = await Feeder.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = feeder);
  console.log(`feeder.deploy ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  // wUST
  tx = await feeder
    .connect(owner)
    .addToken(UST, config.baseRate, config.period, config.wUSTWeight, {
      gasPrice,
    });
  console.log(`feeder.addToken ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  // extTokens
  for await (const token of tokens) {
    tx = await feeder
      .connect(owner)
      .addToken(
        token.address,
        config.baseRate,
        config.period,
        config.extTokenWeight,
        { gasPrice }
      );
    console.log(`feeder.addToken ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);
  }

  tx = await feeder
    .connect(owner)
    .startUpdate([UST, ...tokens.map(({ address }) => address)], {
      gasPrice,
    });
  console.log(`feeder.startUpdate ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  return feeder;
}

export async function replaceFeeder(
  owner: SignerWithAddress,
  target: Contract,
  tokens: Contract[],
  pools: Contract[]
): Promise<Contract> {
  let tx;

  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const feeder = await Feeder.connect(owner).deploy({ gasPrice });
  ({ deployTransaction: tx } = feeder);
  console.log(`feeder.deploy ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, CONFIRMATION);

  // migrate
  for await (const token of tokens) {
    const tokenInfo = await target.connect(owner).tokens(token.address);
    const symbol = await token.symbol();
    if (symbol !== "UST") {
      tx = await feeder
        .connect(owner)
        .addToken(
          token.address,
          "1046435147881158678",
          tokenInfo.period,
          tokenInfo.weight,
          { gasPrice }
        );
    } else {
      tx = await feeder
        .connect(owner)
        .addToken(
          token.address,
          tokenInfo.exchangeRate,
          tokenInfo.period,
          tokenInfo.weight,
          { gasPrice }
        );
    }
    console.log(`${symbol}.addToken ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);
  }

  await feeder.connect(owner).startUpdate(
    tokens.map((t) => t.address),
    { gasPrice }
  );

  for await (const pool of pools) {
    tx = await pool
      .connect(owner)
      .setExchangeRateFeeder(feeder.address, { gasPrice });
    console.log(`pool.setFeeder ${pool.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);
  }

  const tokenInfos = await Promise.all(
    tokens.map(async (t) => {
      const tokenInfo = await feeder.connect(owner).tokens(t.address);
      return {
        token: await (await ethers.getContractAt("ERC20", t.address)).symbol(),
        exchangeRate: tokenInfo.exchangeRate.toString(),
        period: tokenInfo.period.toString(),
        weight: tokenInfo.weight.toString(),
        lastUpdatedAt: tokenInfo.lastUpdatedAt.toString(),
      };
    })
  );
  console.log(tokenInfos);

  for await (const pool of pools) {
    console.log(`${feeder.address} ${await pool.feeder()}`);
  }

  return feeder;
}
