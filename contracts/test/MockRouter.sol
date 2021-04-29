// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

contract MockRouter {
    address public wUST;
    address public aUST;

    constructor(address _wUST, address _aUST) {
        wUST = _wUST;
        aUST = _aUST;
    }
}
