// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Proxy} from "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {IWormhole} from "../interfaces/IWormhole.sol";
import {IWormholeAssetFactory} from "./WormholeAssetFactory.sol";
import {WrappedAsset} from "./WrappedAsset.sol";

interface IWormholeAsset {
    function initalize(
        address _factory,
        address _token,
        uint8 _targetChain
    ) external;

    function burn(uint256 amount, bytes32 to) external;
}

contract WormholeAsset is Initializable, Proxy, Ownable {
    using SafeERC20 for IERC20;

    event Burn(address indexed _sender, bytes32 indexed _to, uint256 amount);

    address public factory;
    address public token;
    uint8 public targetChain;

    function initalize(
        address _factory,
        address _token,
        uint8 _targetChain
    ) public initializer {
        factory = _factory;
        token = _token;
        targetChain = _targetChain;
    }

    function _implementation() internal view override returns (address) {
        return token;
    }

    function burn(uint256 amount, bytes32 to) public {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        address wormhole = IWormholeAssetFactory(factory).wormhole();
        if (IERC20(token).allowance(address(this), wormhole) < amount) {
            IERC20(token).safeApprove(wormhole, type(uint256).max);
        }

        IWormhole(wormhole).lockAssets(token, amount, to, targetChain, 0, true);
        emit Burn(msg.sender, to, amount);
    }
}
