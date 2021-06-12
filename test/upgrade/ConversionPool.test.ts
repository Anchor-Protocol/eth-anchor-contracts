import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { constants, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Queue, Status } from "../utils/TypeOperationStore";
import { AMOUNT, deployCore, HASH1 } from "../shared/deploy-core";
import { Contracts, deployExts, Uniswap } from "../shared/deploy-exts";

chai.use(solidity);

describe("ConversionPool-Upgrade", () => {
  let admin: SignerWithAddress;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let bot: SignerWithAddress;

  let wUST: Contract;
  let aUST: Contract;

  let store: Contract;
  let factory: Contract;
  let router: Contract;
  let controller: Contract;

  let uniswap: Uniswap;
  let pools: Contracts;

  beforeEach("deploy contracts", async () => {
    ({
      role: { admin, owner, user, bot },
      token: { aUST, wUST },
      core: { store, factory, router, controller },
    } = await deployCore());

    const symbols = ["DAI", "USDC", "USDT"];
    ({ uniswap, contracts: pools } = await deployExts(
      router,
      wUST,
      aUST,
      symbols
    ));
  });

  it("upgrade v1 -> v2", async () => {
    const ConversionPoolUpgraderV1 = await ethers.getContractFactory(
      "ConversionPoolUpgraderV1"
    );
    const Proxy = await ethers.getContractFactory("SimpleProxy");

    for await (const [symbol, contracts] of Object.entries(pools)) {
      const poolUpgrader = await ConversionPoolUpgraderV1.connect(
        owner
      ).deploy();
      const poolProxy = await Proxy.attach(contracts.pool.address);

      await poolProxy.connect(admin).changeAdmin(poolUpgrader.address);
      await expect(
        poolUpgrader.connect(owner).upgrade(poolProxy.address, admin.address)
      );

      expect(await poolProxy.admin()).to.eq(admin.address);
    }
  });
});
