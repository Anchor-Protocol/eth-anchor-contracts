import chai, { expect } from "chai";
import { ethers, network } from "hardhat";
import { solidity } from "ethereum-waffle";
import { BigNumber, constants, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { CONTRACTS } from "../contracts";
import { deployCurveSwapper, routeOf } from "../exts";

chai.use(solidity);

const contracts = CONTRACTS["mainnet"];

describe("Router", () => {
  let owner: SignerWithAddress;

  before("setup", async () => {
    if (network.name !== "mainnet_fork") {
      throw new Error("must use mainnet_fork network");
    }

    [owner] = await ethers.getSigners();
  });

  let swapper: Contract;
  let UST: Contract;
  let DAI: Contract;
  let USDT: Contract;
  let USDC: Contract;
  let BUSD: Contract;

  beforeEach("deploy contracts", async () => {
    const ERC20 = await ethers.getContractFactory("ERC20");
    UST = await ERC20.attach(contracts.UST);
    DAI = await ERC20.attach(contracts.DAI);
    USDT = await ERC20.attach(contracts.USDT);
    USDC = await ERC20.attach(contracts.USDC);
    BUSD = await ERC20.attach(contracts.BUSD);

    swapper = await deployCurveSwapper(owner, {
      routes: [
        routeOf(contracts, "DAI"),
        routeOf(contracts, "USDT"),
        routeOf(contracts, "USDC"),
        routeOf(contracts, "BUSD"),
      ],
    });
  });

  it("DAI USDT USDC", async () => {
    for await (const [symbol, amount] of [
      ["DAI", constants.WeiPerEther.mul(100).toString()],
      ["USDT", "100000000"],
      ["USDC", "100000000"],
    ]) {
      const token = await ethers.getContractAt("IERC20", contracts[symbol]);

      await token
        .connect(owner)
        .approve(swapper.address, constants.WeiPerEther.pow(2));

      await expect(
        swapper
          .connect(owner)
          .swapToken(
            contracts.DAI,
            contracts.UST,
            amount,
            BigNumber.from(amount).mul(98).div(100),
            owner.address
          )
      ).not.to.reverted;
    }
  });

  it("BUSD", async () => {
    await BUSD.connect(owner).approve(
      swapper.address,
      constants.WeiPerEther.pow(2)
    );

    await swapper
      .connect(owner)
      .swapToken(
        BUSD.address,
        UST.address,
        constants.WeiPerEther.mul(100),
        constants.WeiPerEther.mul(98),
        owner.address
      );
  });
});
