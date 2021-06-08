import { utils } from "ethers";
import { network } from "hardhat";
import { isLocalNetwork } from "./utils";

export const GAS_PRICE = utils.parseUnits("50", "gwei");

let confirmation = 0;
if (!isLocalNetwork()) {
  confirmation = 2;
}

export const CONFIRMATION = confirmation;

export type Contracts = { [name: string]: string };
export const CONTRACTS = {
  mainnet: {
    // uniswap
    UniRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    // terra
    aUST: "0xa8De3e3c934e2A1BB08B010104CcaBBD4D6293ab",
    UST: "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD",
    // ether
    DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
    USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    BUSD: "0x4fabb145d64652a948d72533023f6e7a623c7c53",
    CrvUSTPool: "0x890f4e345B1dAED0367A877a1612f86A1f86985f",
    CrvBUSDPool: "0x4807862AA8b2bF68830e4C8dc86D0e9A998e085a",
  },
  ropsten: {
    // uniswap
    UniRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    // terra
    aUST: "0x006479f75D6622AE6a21BE17C7F555B94c672342",
    UST: "0x6cA13a4ab78dd7D657226b155873A04DB929A3A4",
    // ether
    DAI: "0x6bb59e3f447222b3fcf2847111700723153f625a",
    USDT: "0x6af27a81ceb61073ccca401ca6b43064f369dc02",
    USDC: "0xe015fd30cce08bc10344d934bdb2292b1ec4bbbd",
    BUSD: "0xaae6df09ae0d322a666edc63e6a69e4b0fab6f5d",
  },
} as { [network: string]: Contracts };
