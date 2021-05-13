// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {WrappedAsset} from "../assets/WrappedAsset.sol";

contract MockAsset is WrappedAsset, ERC20 {
    address public owner;

    constructor(string memory _name, string memory _symbol)
        ERC20(_name, _symbol)
    {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burn(uint256 amount, bytes32) public override {
        _transfer(msg.sender, owner, amount);
    }
}
