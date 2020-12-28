// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./WrappedToken.sol";

contract TerraUSD is WrappedToken {
    constructor() public WrappedToken("Wrapped UST Token", "UST") {}
}