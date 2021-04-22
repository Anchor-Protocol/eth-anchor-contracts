// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";

import {IWormhole} from "../interfaces/IWormhole.sol";
import {WrappedAsset} from "./WrappedAsset.sol";

contract WormholeAsset is Proxy, Ownable {
    address public wormhole;
    address public token;
    uint8 public targetChain;

    function configure(
        address _wormhole,
        address _token,
        uint8 _targetChain
    ) public onlyOwner {
        wormhole = _wormhole;
        token = _token;
        targetChain = _targetChain;
    }

    function initialized() public view returns (bool) {
        return (wormhole != address(0x0) && token != address(0x0));
    }

    function _implementation() internal view override returns (address) {
        return token;
    }

    function burn(uint256 amount, bytes32 to) public {
        require(initialized(), "WormholeAsset: not initialized");
        IWormhole(wormhole).lockAssets(token, amount, to, targetChain, 0, true);
    }
}
