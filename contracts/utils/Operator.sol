// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {Context} from "@openzeppelin/contracts/utils/Context.sol";

contract Operator is Context {
    address public owner;
    address public operator;

    constructor() {
        owner = _msgSender();
        operator = _msgSender();
    }

    function setRole(address _owner, address _operator) internal virtual {
        owner = _owner;
        operator = _operator;
    }

    modifier onlyOwner {
        require(checkOwner(), "Operator: owner access denied");

        _;
    }

    function checkOwner() public view returns (bool) {
        return _msgSender() == owner;
    }

    modifier onlyOperator {
        require(checkOperator(), "Operator: operator access denied");

        _;
    }

    function checkOperator() public view returns (bool) {
        return _msgSender() == operator;
    }

    modifier onlyGranted {
        require(checkGranted(), "Operator: access denied");

        _;
    }

    function checkGranted() public view returns (bool) {
        return checkOwner() || checkOperator();
    }

    function transferOwnership(address _owner) public onlyOwner {
        owner = _owner;
    }

    function transferOperator(address _operator) public onlyOwner {
        operator = _operator;
    }
}
