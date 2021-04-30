import { BigNumber, constants } from "ethers";
import { ethers, run } from "hardhat";
import { encodeParameters } from "../test/shared/utilities";
import { CONTRACTS } from "./contracts";

async function main() {
  const { provider } = ethers;

  const [operator] = await ethers.getSigners();

  const Feeder = await ethers.getContractFactory("ExchangeRateFeeder");
  const Pool = await ethers.getContractFactory("ConversionPool");

  const feeder = await Feeder.connect(operator).deploy();
  console.log(`waiting ${feeder.address} ${feeder.deployTransaction.hash}`);
  await provider.waitForTransaction(feeder.deployTransaction.hash, 2);

  let tx;

  const { ropsten } = CONTRACTS;

  tx = await feeder
    .connect(operator)
    .addToken(
      ropsten.aUST,
      constants.WeiPerEther,
      86400,
      BigNumber.from("1000015954686906531")
    );
  console.log(`waiting ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await feeder
    .connect(operator)
    .addToken(
      ropsten.DAI,
      constants.WeiPerEther,
      86400,
      BigNumber.from("1000015954686906531")
    );
  console.log(`waiting ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await feeder.connect(operator).startUpdate([ropsten.aUST, ropsten.DAI]);
  console.log(`waiting ${feeder.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  const pool = await Pool.connect(operator).deploy();
  console.log(`waiting ${pool.address} ${pool.deployTransaction.hash}`);
  await provider.waitForTransaction(pool.deployTransaction.hash, 2);

  tx = await pool
    .connect(operator)
    .initialize(
      "Anchor DAI Token",
      "aDAI",
      ropsten.DAI,
      ropsten.WETH,
      ropsten.UST,
      ropsten.aUST,
      "0x6DeE4E68bA16B5794ffa49b1210c3C5c35bCE5a0",
      ropsten.UniRouter,
      feeder.address
    );
  console.log(`waiting ${pool.address} ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  for await (const addr of [feeder.address, pool.address]) {
    await run("verify:verify", {
      address: addr,
      constructorArguments: [],
    });
  }

  console.log({
    feeder: feeder.address,
    pool: pool.address,
  });
}

main().catch(console.error);
