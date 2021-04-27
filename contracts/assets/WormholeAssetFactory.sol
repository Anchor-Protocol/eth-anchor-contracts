// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IWormholeAsset, WormholeAsset} from "./WormholeAsset.sol";

interface IWormholeAssetFactory {
    function wormhole() external view returns (address);
}

contract WormholeAssetFactory is IWormholeAssetFactory, Ownable {
    address public implementation;

    constructor() {
        WormholeAsset asset = new WormholeAsset();
        asset.initalize(address(0x0), address(0x0), 0);
        implementation = address(asset);
    }

    address public override wormhole;

    function setWormhole(address _wormhole) public onlyOwner {
        wormhole = _wormhole;
    }

    function wrap(address _token, uint8 _targetChain) public returns (address) {
        address instance = Clones.clone(implementation);
        IWormholeAsset(instance).initalize(address(this), _token, _targetChain);
        return instance;
    }
}
