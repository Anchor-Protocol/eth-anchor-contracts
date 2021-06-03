import { constants } from "ethers";
import { ethers, network, run } from "hardhat";
import { CONTRACTS, GAS_PRICE as gasPrice } from "./contracts";
import { deployExternalContracts, isLocalNetwork } from "./local";

async function main(): Promise<void> {
  const { provider } = ethers;

  let [operator] = await ethers.getSigners();

  let contracts: { [name: string]: string };
  if (!isLocalNetwork()) {
    contracts = CONTRACTS[network.name];
  } else {
    contracts = await deployExternalContracts(operator);
  }

  const Swapper = await ethers.getContractFactory("CurveSwapper");
  const swapper = await Swapper.connect(operator).deploy({ gasPrice });
  console.log(`Deploy swapper ${swapper.deployTransaction.hash}`);
  await provider.waitForTransaction(swapper.deployTransaction.hash, 2);

  console.log(swapper.address);
  await run("verify:verify", {
    address: swapper.address,
    constructorArguments: [],
  });

  let tx;

  const UST = await ethers.getContractAt("IERC20", contracts.UST);
  tx = await UST.connect(operator).approve(
    swapper.address,
    constants.WeiPerEther.pow(2),
    { gasPrice }
  );
  console.log(`UST.approve ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // ust -> dai
  tx = await swapper
    .connect(operator)
    .setRoute(
      contracts.UST,
      contracts.DAI,
      [contracts.CrvUSTPool],
      [contracts.UST],
      [0, 1],
      {
        gasPrice,
      }
    );
  console.log(`Swapper.setRoute ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await swapper
    .connect(operator)
    .swapToken(
      contracts.UST,
      contracts.DAI,
      constants.WeiPerEther,
      0,
      operator.address,
      { gasPrice }
    );
  console.log(`UST => DAI ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // ust -> usdc
  tx = await swapper
    .connect(operator)
    .setRoute(
      contracts.UST,
      contracts.USDC,
      [contracts.CrvUSTPool],
      [contracts.UST],
      [0, 2],
      {
        gasPrice,
      }
    );
  console.log(`Swapper.setRoute ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await swapper
    .connect(operator)
    .swapToken(
      contracts.UST,
      contracts.USDC,
      constants.WeiPerEther,
      0,
      operator.address,
      { gasPrice }
    );
  console.log(`UST => USDC ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // ust -> usdt
  tx = await swapper
    .connect(operator)
    .setRoute(
      contracts.UST,
      contracts.USDT,
      [contracts.CrvUSTPool],
      [contracts.UST],
      [0, 3],
      {
        gasPrice,
      }
    );
  console.log(`Swapper.setRoute ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  tx = await swapper
    .connect(operator)
    .swapToken(
      contracts.UST,
      contracts.USDT,
      constants.WeiPerEther,
      0,
      operator.address,
      { gasPrice }
    );
  console.log(`UST => USDT ${tx.hash}`);
  await provider.waitForTransaction(tx.hash, 2);

  // // ust -> usdc -> busd
  // tx = await swapper
  //   .connect(operator)
  //   .setRoute(
  //     contracts.UST,
  //     contracts.BUSD,
  //     [contracts.CrvUSTPool, contracts.CrvBUSDPool],
  //     [contracts.UST, contracts.USDC],
  //     [0, 2, 1, 3],
  //     { gasPrice }
  //   );
  // console.log(`Swapper.setRoute ${tx.hash}`);
  // await provider.waitForTransaction(tx.hash, 2);

  // tx = await swapper
  //   .connect(operator)
  //   .swapToken(
  //     contracts.UST,
  //     contracts.BUSD,
  //     constants.WeiPerEther,
  //     0,
  //     operator.address,
  //     { gasPrice }
  //   );
  // console.log(`UST => BUSD ${tx.hash}`);
  // await provider.waitForTransaction(tx.hash, 2);
}

main().catch(console.error);
