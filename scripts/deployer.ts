import { BigNumber, Contract } from "ethers";
import { ethers, network } from "hardhat";
import { ContractArchive } from "../archive/deployed";

import { CONTRACTS, Contracts } from "./contracts";
import { Core, deployCore } from "./core";
import { deployExtension, Extensions, FeederConfig, routeOf } from "./exts";
import { upgradeV1 } from "./upgrade/v1";
import { deployExternalContracts, isLocalNetwork } from "./utils";

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

  // ============================= core
  const core = await deployCore(contracts, owner, admin, isLocal);
  const coreAddrs = JSON.stringify(core.toContracts(), null, 2);
  console.log(`Core contracts deployed. ${coreAddrs}`);

  // ============================= extensions
  const tokens: Contract[] = [];
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
        routeOf(contracts, "DAI"),
        routeOf(contracts, "USDC"),
        routeOf(contracts, "USDT"),
        routeOf(contracts, "BUSD"),
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

main().catch(console.error);
