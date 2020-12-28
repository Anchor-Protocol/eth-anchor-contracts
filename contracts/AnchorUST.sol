// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import "./WrappedToken.sol";

contract AnchorUST is WrappedToken {
    constructor() public WrappedToken("Wrapped Anchor UST Token", "aUST") {}
}