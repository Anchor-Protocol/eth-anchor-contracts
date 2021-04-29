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

describe("Queue", () => {
  const { provider } = ethers;

  let operator: SignerWithAddress;

  before("setup", async () => {
    [operator] = await ethers.getSigners();
  });

  let tester: Contract;

  beforeEach("deploy contracts", async () => {
    const QueueTester = await ethers.getContractFactory("QueueTester");
    tester = await QueueTester.connect(operator).deploy();
  });

  it("works well", async () => {
    expect(await tester.isEmpty()).to.be.true;

    const hash1 =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

    await tester.produce(hash1);
    expect(await tester.getItemAt(0)).to.eq(hash1);
    expect(await tester.isEmpty()).to.be.false;

    const hash2 =
      "0xbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdead";
    await tester.produce(hash2);
    expect(await tester.getItemAt(1)).to.eq(hash2);
    expect(await tester.isEmpty()).to.be.false;

    await expect(tester.consume()).to.emit(tester, "Consumed").withArgs(hash1);
    await expect(tester.consume()).to.emit(tester, "Consumed").withArgs(hash2);

    expect(await tester.getItemAt(0)).to.eq(
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    expect(await tester.isEmpty()).to.be.true;

    await expect(tester.consume()).to.revertedWith("StdQueue: empty queue");

    await tester.produce(hash1);
    expect(await tester.getItemAt(0)).to.eq(hash1);
    expect(await tester.isEmpty()).to.be.false;
  });
});
