// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {
    IUniswapV2Router02
} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {ISwapper} from "./ConversionPool.sol";

contract UniswapProxy is ISwapper, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public bridgeToken = address(0x0);
    IUniswapV2Router02 public router;

    constructor(address _router) {
        router = IUniswapV2Router02(_router);
    }

    function setRouter(address _router) public onlyOwner {
        router = IUniswapV2Router02(_router);
    }

    function setBridgeToken(address _bridgeToken) public onlyOwner {
        bridgeToken = _bridgeToken;
    }

    function swapTokens(
        address _from,
        address _to,
        uint256 _amount
    ) public override {
        IERC20(_from).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_from).safeIncreaseAllowance(address(router), _amount);

        address[] memory path;

        if (bridgeToken == address(0x0)) {
            path = new address[](2);
            path[0] = _from;
            path[1] = _to;
        } else {
            path = new address[](3);
            path[0] = _from;
            path[1] = bridgeToken;
            path[2] = _to;
        }

        router.swapExactTokensForTokens(
            _amount,
            0,
            path,
            msg.sender,
            block.timestamp.add(60)
        );
    }
}
