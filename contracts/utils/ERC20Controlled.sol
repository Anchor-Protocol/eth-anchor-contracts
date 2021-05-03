// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

interface IERC20Controlled is IERC20 {
    function mint(uint256 amount) external;

    function burn(uint256 amount) external;
}

contract ERC20Controlled is Context, Ownable, IERC20Controlled, ERC20 {
    constructor(string memory _name, string memory _symbol)
        Ownable()
        ERC20(_name, _symbol)
    {}

    function mint(uint256 amount) public override onlyOwner {
        _mint(_msgSender(), amount);
    }

    function burn(uint256 amount) public override {
        _burn(_msgSender(), amount);
    }
}
