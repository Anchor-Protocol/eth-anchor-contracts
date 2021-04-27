// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {IWormhole} from "../interfaces/IWormhole.sol";
import {WrappedAsset} from "./WrappedAsset.sol";

contract WormholeAsset is Initializable, Proxy, Ownable {
    event Burn(address indexed _sender, bytes32 indexed _to, uint256 amount);

    address public wormhole;
    address public token;
    uint8 public targetChain;

    function initalize(
        address _wormhole,
        address _token,
        uint8 _targetChain
    ) public initializer {
        wormhole = _wormhole;
        token = _token;
        targetChain = _targetChain;
    }

    function _implementation() internal view override returns (address) {
        return token;
    }

    function burn(uint256 amount, bytes32 to) public {
        IWormhole(wormhole).lockAssets(token, amount, to, targetChain, 0, true);
        emit Burn(msg.sender, to, amount);
    }
}
