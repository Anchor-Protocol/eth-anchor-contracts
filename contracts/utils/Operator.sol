// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;

contract Operator {
    address public owner;
    address public operator;

    constructor() {
        owner = msg.sender;
        operator = msg.sender;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "Operator: owner access denied");

        _;
    }

    modifier onlyOperator {
        require(msg.sender == operator, "Operator: operator access denied");

        _;
    }

    modifier onlyGranted {
        require(
            msg.sender == owner || msg.sender == operator,
            "Operator: access denied"
        );

        _;
    }

    function transferOwnership(address _owner) public onlyOwner {
        owner = _owner;
    }

    function transferOperator(address _operator) public onlyOwner {
        operator = _operator;
    }
}
