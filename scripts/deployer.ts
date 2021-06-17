import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { ethers, network } from "hardhat";
import { ContractArchive } from "../archive/deployed";

import {
  CONTRACTS,
  CONFIRMATION,
  GAS_PRICE as gasPrice,
  Contracts,
} from "./contracts";
import { Core, deployCore } from "./core";
import { deployExtension, Extensions, FeederConfig, routeOf } from "./exts";
import { replaceFeeder } from "./exts/ExchangeRateFeeder";
import { upgradeV1 } from "./upgrade/v1";
import { deployExternalContracts, isLocalNetwork } from "./utils";

const { provider } = ethers;

async function deploy(
  contracts: Contracts,
  owner: SignerWithAddress,
  admin: SignerWithAddress,
  isLocal: boolean = true
) {
  // ============================= core
  const core = await deployCore(contracts, owner, admin, isLocal);
  const coreAddrs = JSON.stringify(core.toContracts(), null, 2);
  console.log(`Core contracts deployed. ${coreAddrs}`);

  // ============================= extensions
  const tokens = [];
  tokens.push(await ethers.getContractAt("ERC20", contracts.DAI));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDT));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDC));
  tokens.push(await ethers.getContractAt("ERC20", contracts.BUSD));

  const feederConfig: FeederConfig = {
    baseRate: BigNumber.from("1042036828493072337"),
    period: 21600,
    wUSTWeight: BigNumber.from("1000113372479925668"),
    extTokenWeight: BigNumber.from("1000095731939800926"),
  };

  const exts = await deployExtension(
    contracts,
    owner,
    admin,
    core.router,
    tokens,
    /* ========== curve ========== */
    {
      routes: [
        ...routeOf(contracts, "DAI"),
        ...routeOf(contracts, "USDC"),
        ...routeOf(contracts, "USDT"),
        ...routeOf(contracts, "BUSD"),
      ],
    },
    /* ========== uniswap ========== */
    // { uniswapFactory: contracts.UniFactory },
    feederConfig,
    isLocal
  );
  const extsAddrs = JSON.stringify(exts.toContracts(), null, 2);
  console.log(`Extension contracts deployed. ${extsAddrs}`);

  // ============================= upgrade

  //   const routerAddr = ""; // fill this
  //   const router = await ethers.getContractAt("Router", routerAddr);
  //   const poolsAddr = [""]; // fill this
  //   const pools = await Promise.all(
  //     poolsAddr.map((addr) => ethers.getContractAt("ConversionPool", addr))
  //   );
  //   const [owner, admin] = await ethers.getSigners();
  //   let contracts: Contracts;
  //   let isLocal = isLocalNetwork();
  //   if (!isLocal) {
  //     contracts = CONTRACTS[network.name];
  //   } else {
  //     contracts = await deployExternalContracts(owner);
  //   }

  await upgradeV1(
    contracts,
    owner,
    admin,
    core.router,
    Object.values(exts.pools).map((v) => v.pool)
  );
}

async function changeExchangeRate(
  owner: SignerWithAddress,
  feeder: Contract,
  tokens: Contract[],
  rate: BigNumberish,
  period: BigNumberish,
  weight: BigNumberish
): Promise<void> {
  let tx;

  for await (const token of tokens) {
    const symbol = await token.symbol();
    tx = await feeder
      .connect(owner)
      .addToken(token.address, rate, period, weight, {
        gasPrice,
      });

    console.log(`${symbol}.addToken ${feeder.address} ${tx.hash}`);
    await provider.waitForTransaction(tx.hash, CONFIRMATION);
  }

  tx = await feeder.connect(owner).startUpdate(
    tokens.map((t) => t.address),
    { gasPrice }
  );
  console.log(`feeder.startUpdate ${feeder.address} ${tx.hash}`);
}

async function main() {
  const [owner, admin] = await ethers.getSigners();

  let contracts: Contracts;
  let isLocal = isLocalNetwork();
  if (!isLocal) {
    contracts = CONTRACTS[network.name];
  } else {
    contracts =
      network.name === "mainnet_fork"
        ? CONTRACTS["mainnet"]
        : await deployExternalContracts(owner);
  }

  let core, exts;
  let tokens: Contract[] = [];

  core = await Core.fromContracts(ContractArchive.mainnetV2.core);
  exts = await Extensions.fromContracts(ContractArchive.mainnetV2.exts);

  tokens = [];
  // tokens.push(await ethers.getContractAt("ERC20", contracts.UST));
  tokens.push(await ethers.getContractAt("ERC20", contracts.DAI));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDT));
  tokens.push(await ethers.getContractAt("ERC20", contracts.USDC));
  tokens.push(await ethers.getContractAt("ERC20", contracts.BUSD));

  await changeExchangeRate(
    owner,
    exts.feeder,
    tokens,
    "1047537625424102549",
    "21600",
    "1000095731939800926"
  );

  // const feeder = await replaceFeeder(
  //   owner,
  //   exts.feeder,
  //   tokens,
  //   Object.values(exts.pools).map((v) => v.pool)
  // );
  // console.log(feeder.address);

  return;

  // await deploy(contracts, owner, admin, isLocal);
}

main().catch(console.error);
