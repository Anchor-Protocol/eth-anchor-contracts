// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {
    IUniswapV2Pair
} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import {ISwapper} from "./ISwapper.sol";
import {UniswapV2Library} from "../libraries/UniswapV2Library.sol";

contract UniswapSwapper is ISwapper, Ownable {
    using SafeERC20 for IERC20;

    address public factory;
    address public bridgeToken;

    function setSwapFactory(address _factory) public onlyOwner {
        factory = _factory;
    }

    function setBridgeToken(address _bridgeToken) public onlyOwner {
        bridgeToken = _bridgeToken;
    }

    // swap: fetched from Uniswap/uniswap-v2-periphery
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) private {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = UniswapV2Library.sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) =
                input == token0
                    ? (uint256(0), amountOut)
                    : (amountOut, uint256(0));
            address to =
                i < path.length - 2
                    ? UniswapV2Library.pairFor(factory, output, path[i + 2])
                    : _to;
            IUniswapV2Pair(UniswapV2Library.pairFor(factory, input, output))
                .swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapToken(
        address _from,
        address _to,
        uint256 _amount,
        address _beneficiary
    ) public override {
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

        uint256[] memory amounts =
            UniswapV2Library.getAmountsOut(factory, _amount, path);
        require(
            amounts[amounts.length - 1] >= 0,
            "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            UniswapV2Library.pairFor(factory, path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, _beneficiary);
    }
}
