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
import { deployCore } from "../shared/deploy-core";

chai.use(solidity);

describe("SimpleProxy", () => {
  const { provider } = ethers;

  it("works well", async () => {
    const [owner, operator] = await ethers.getSigners();
    const Tester = await ethers.getContractFactory("TestProxy");
    const Proxy = await ethers.getContractFactory("SimpleProxy");

    const tester = await Tester.connect(operator).deploy();
    const proxy = await Proxy.connect(owner).deploy(tester.address);
    const wtester = await ethers.getContractAt("TestProxy", proxy.address);
    await wtester.connect(operator).initialize();

    await expect(tester.connect(operator).test()).to.reverted;
    await expect(wtester.connect(operator).test()).not.to.reverted;
  });
});
