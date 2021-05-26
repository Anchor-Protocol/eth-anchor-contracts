import chai, { expect, should } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
  constants,
} from "ethers";
import { Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {
  advanceTimeAndBlock,
  encodeParameters,
  filterStructFields,
  latestBlocktime,
} from "../shared/utilities";
import {
  HOUR_PERIOD,
  HOUR_YIELD_15,
  HOUR_YIELD_20,
} from "../utils/TypeExchangeRateFeeder";

chai.use(solidity);

describe("ExchangeRateFeeder", () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let operator: SignerWithAddress;

  before("setup", async () => {
    [owner, operator] = await ethers.getSigners();
  });

  let tokenA: Contract;
  let tokenB: Contract;
  let feeder: Contract;

  beforeEach("deploy contract", async () => {
    const TestAsset = await ethers.getContractFactory("TestAsset");
    tokenA = await TestAsset.connect(owner).deploy();
    tokenB = await TestAsset.connect(owner).deploy();

    const ExchangeRateFeeder = await ethers.getContractFactory(
      "ExchangeRateFeeder"
    );
    feeder = await ExchangeRateFeeder.connect(owner).deploy();
    await feeder
      .connect(owner)
      .addToken(
        tokenA.address,
        constants.WeiPerEther,
        HOUR_PERIOD,
        HOUR_YIELD_15
      );
    await feeder
      .connect(owner)
      .addToken(
        tokenB.address,
        constants.WeiPerEther,
        HOUR_PERIOD,
        HOUR_YIELD_20
      );
  });

  it("control", async () => {
    let tx, block;

    tx = await feeder
      .connect(owner)
      .startUpdate([tokenA.address, tokenB.address]);

    block = await provider.getBlock(tx.blockHash);

    for await (const token of [tokenA.address, tokenB.address]) {
      expect(
        await filterStructFields(
          ["status", "lastUpdatedAt"],
          feeder.tokens(token)
        )
      ).to.deep.eq({
        status: 1, // running
        lastUpdatedAt: BigNumber.from(block.timestamp),
      });
    }

    await feeder.connect(owner).stopUpdate([tokenA.address, tokenB.address]);

    for await (const token of [tokenA.address, tokenB.address]) {
      expect(
        await filterStructFields(
          ["status", "lastUpdatedAt"],
          feeder.tokens(token)
        )
      ).to.deep.eq({
        status: 2, // stopped
        lastUpdatedAt: BigNumber.from(block.timestamp),
      });
    }
  });

  describe("update", () => {
    beforeEach("start", async () => {
      await feeder.connect(owner).startUpdate([tokenA.address, tokenB.address]);
    });

    it("#update", async () => {
      await advanceTimeAndBlock(provider, 365 * 86400); // 1 year
      for await (const token of [tokenA.address, tokenB.address]) {
        await feeder.connect(operator).update(token);
      }

      const exchangeRateA = utils.formatEther(
        await feeder.exchangeRateOf(tokenA.address, false)
      );
      expect(Math.round(Number(exchangeRateA) * 100)).to.eq(115); // 1.15%;

      const exchangeRateB = utils.formatEther(
        await feeder.exchangeRateOf(tokenB.address, false)
      );
      expect(Math.round(Number(exchangeRateB) * 100)).to.eq(120); // 1.20%
    });
  });
});
