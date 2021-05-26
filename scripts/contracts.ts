export const CONTRACTS = {
  mainnet: {
    // uniswap
    UniRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    // terra
    aUST: "0xa8De3e3c934e2A1BB08B010104CcaBBD4D6293ab",
    UST: "0xa47c8bf37f92aBed4A126BDA807A7b7498661acD",
    // ether
    WETH: "",
    DAI: "",
    USDT: "",
    USDC: "",
  },
  ropsten: {
    // uniswap
    UniRouter: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UniFactory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    // terra
    aUST: "0x006479f75D6622AE6a21BE17C7F555B94c672342",
    UST: "0x6cA13a4ab78dd7D657226b155873A04DB929A3A4",
    // ether
    WETH: "0xc778417e063141139fce010982780140aa0cd5ab",
    DAI: "0xad6d458402f60fd3bd25163575031acdce07538d",
    USDT: "0x516de3a7A567d81737e3a46ec4FF9cFD1fcb0136",
    USDC: "0x0D9C8723B343A8368BebE0B5E89273fF8D712e3C",
  },
} as { [network: string]: { [name: string]: string } };
