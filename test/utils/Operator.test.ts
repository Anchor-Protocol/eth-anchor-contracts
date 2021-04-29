import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
} from "ethers";
import { Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { advanceTimeAndBlock, latestBlocktime } from "../shared/utilities";

chai.use(solidity);

describe("Operator", () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let operator: SignerWithAddress;

  before("setup", async () => {
    [owner, operator] = await ethers.getSigners();
  });

  let target: Contract;

  beforeEach("deploy contract", async () => {
    const Operator = await ethers.getContractFactory("Operator");
    target = await Operator.connect(owner).deploy();
  });

  it("works well", async () => {
    expect(await target.owner()).to.eq(owner.address);
    expect(await target.operator()).to.eq(owner.address);

    await target.connect(owner).transferOperator(operator.address);
    expect(await target.operator()).to.eq(operator.address);

    expect(await target.connect(owner).checkOwner()).to.be.true;
    expect(await target.connect(owner).checkOperator()).to.be.false;
    expect(await target.connect(operator).checkOwner()).to.be.false;
    expect(await target.connect(operator).checkOperator()).to.be.true;
    expect(await target.connect(owner).checkGranted()).to.be.true;
    expect(await target.connect(operator).checkGranted()).to.be.true;

    await target.connect(owner).transferOwnership(operator.address);
    expect(await target.owner()).to.eq(operator.address);
  });
});
