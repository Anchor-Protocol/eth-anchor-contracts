// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

interface WrappedAsset {
    event Burn(address indexed _sender, bytes32 indexed _to, uint256 amount);

    function burn(uint256 amount, bytes32 to) external;
}
