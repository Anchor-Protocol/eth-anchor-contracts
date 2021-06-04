import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import { constants, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { Queue, Status } from "../utils/TypeOperationStore";
import { AMOUNT, deployCore, HASH1 } from "../shared/deploy-core";

chai.use(solidity);

describe("Router-Upgrade", () => {
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

  beforeEach("deploy contracts", async () => {
    ({
      role: { admin, owner, user, bot },
      token: { aUST, wUST },
      core: { store, factory, router, controller },
    } = await deployCore());
  });

  it("upgrade v1 -> v2", async () => {
    const RouterUpgraderV1 = await ethers.getContractFactory(
      "RouterUpgraderV1"
    );
    const Proxy = await ethers.getContractFactory("SimpleProxy");

    const routerUpgrader = await RouterUpgraderV1.connect(owner).deploy();
    const routerProxy = await Proxy.attach(router.address);

    for await (const token of [aUST, wUST]) {
      await token
        .connect(owner)
        .mint(owner.address, constants.WeiPerEther.mul(10));
      await token
        .connect(owner)
        .approve(routerUpgrader.address, constants.WeiPerEther.mul(10));
    }
    await routerProxy.connect(admin).changeAdmin(routerUpgrader.address);
    await expect(
      routerUpgrader.connect(owner).upgrade(routerProxy.address, admin.address)
    )
      .to.emit(routerUpgrader, "DepositReturns")
      .to.emit(routerUpgrader, "RedeemReturns");

    expect(await routerProxy.admin()).to.eq(admin.address);
  });
});
