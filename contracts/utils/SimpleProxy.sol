// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";

contract StdProxy is Proxy, Ownable {
    address public impl;

    function setImplementation(address _impl) public onlyOwner {
        impl = _impl;
    }

    function _implementation() internal view override returns (address) {
        return impl;
    }
}
