// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {Operation} from "./Operation.sol";

contract Factory is Ownable {
    // permission
    mapping(address => bool) public permission;

    function allow(address _target) public onlyOwner {
        permission[_target] = true;
    }

    function deny(address _target) public onlyOwner {
        permission[_target] = false;
    }

    function isPermissioned(address _target) public view returns (bool) {
        return permission[_target];
    }

    // standard operations
    mapping(uint256 => address) public standards;

    function setStandardOperation(uint256 _optId, address _operation)
        public
        onlyOwner
    {
        standards[_optId] = _operation;
    }

    function build(uint256 _optId) public returns (address) {
        require(isPermissioned(msg.sender), "Factory: not allowed");
        return Clones.clone(standards[_optId]);
    }
}
