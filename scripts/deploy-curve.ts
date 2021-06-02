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
  await provider.waitForTransaction(swapper.deployTransaction.hash, 2);

  let tx;

  // // ust -> dai
  // tx = await swapper
  //   .connect(operator)
  //   .setRoute(contracts.UST, contracts.DAI, [contracts.CrvUSTPool], [0, 2], {
  //     gasPrice,
  //   });
  // await provider.waitForTransaction(tx.hash, 2);

  // // ust -> usdc
  // tx = await swapper
  //   .connect(operator)
  //   .setRoute(contracts.UST, contracts.USDC, [contracts.CrvUSTPool], [0, 4], {
  //     gasPrice,
  //   });
  // await provider.waitForTransaction(tx.hash, 2);

  // // ust -> usdt
  // tx = await swapper
  //   .connect(operator)
  //   .setRoute(contracts.UST, contracts.USDT, [contracts.CrvUSTPool], [0, 3], {
  //     gasPrice,
  //   });
  // await provider.waitForTransaction(tx.hash, 2);

  // ust -> usdc -> busd
  tx = await swapper
    .connect(operator)
    .setRoute(
      contracts.UST,
      contracts.BUSD,
      [contracts.CrvUSTPool, contracts.CrvBUSDPool],
      [contracts.UST, contracts.USDC],
      [0, 2, 1, 0],
      { gasPrice }
    );
  await provider.waitForTransaction(tx.hash, 2);

  const UST = await ethers.getContractAt("IERC20", contracts.UST);
  tx = await UST.connect(operator).approve(
    swapper.address,
    constants.WeiPerEther.pow(2)
  );
  await provider.waitForTransaction(tx.hash, 2);

  console.log(swapper.address);
  await run("verify:verify", {
    address: swapper.address,
    constructorArguments: [],
  });
}

main().catch(console.error);
