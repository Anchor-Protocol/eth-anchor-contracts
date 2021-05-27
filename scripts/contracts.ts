export const CONTRACTS = {
  mainnet: {
    // uniswap
    UniRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    // terra
    aUST: "0xa8De3e3c934e2A1BB08B010104CcaBBD4D6293ab",
    UST: "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD",
    // ether
    DAI: "",
    USDT: "",
    USDC: "",
    BUSD: "",
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
} as { [network: string]: { [name: string]: string } };
