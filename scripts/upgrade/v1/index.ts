import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

import { Contracts } from "../../contracts";
import { upgradeV1Router } from "./core";
import { upgradeV1ConversionPool } from "./exts";

async function upgradeV1(
  contracts: Contracts,
  owner: SignerWithAddress,
  admin: SignerWithAddress,
  router?: Contract,
  pools?: Contract[]
) {
  if (router) {
    await upgradeV1Router(
      contracts.UST,
      contracts.aUST,
      router.address,
      owner,
      admin
    );
  }
  if (pools) {
    for await (const pool of pools) {
      await upgradeV1ConversionPool(pool.address, owner, admin);
    }
  }
}

export { upgradeV1, upgradeV1Router, upgradeV1ConversionPool };
