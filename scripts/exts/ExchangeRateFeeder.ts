import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

import { CONFIRMATION, GAS_PRICE as gasPrice } from "../contracts";

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
