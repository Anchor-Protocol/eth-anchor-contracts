// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ISwapper} from "./ISwapper.sol";

interface ICurve {
    function coins(uint256 i) external view returns (address); // pool

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);

    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}

contract CurveSwapper is ISwapper, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct Route {
        address[] pools;
        int128[] indexes;
    }

    mapping(address => mapping(address => Route)) private routes;

    function setRoute(
        address _from,
        address _to,
        address[] memory _pools,
        int128[] memory _indexes
    ) public onlyOwner {
        require(_indexes.length >= 2, "CurveSwapper: INVALID_PATH");
        require(
            _pools.length.mul(2) == _indexes.length,
            "CurveSwapper: INVAILD_LENGTH"
        );
        Route storage route = routes[_from][_to];
        route.pools = _pools;
        route.indexes = _indexes;
    }

    // pools[]    a   b   c   d   pool.length  * 2 = indexes.length
    // indexes[]  0 1 1 2 2 3 3 4

    function _getAmountsOut(uint256 _amount, Route memory route)
        private
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](route.pools.length);
        amounts[0] = _amount;
        for (uint256 i = 0; i < route.pools.length; i++) {
            amounts[i] = ICurve(route.pools[i]).get_dy(
                route.indexes[i.mul(2)],
                route.indexes[i.mul(2).add(1)],
                amounts[i]
            );
        }
    }

    function swapToken(
        address _from, // ignore
        address _to, // ignore
        uint256 _amount,
        uint256 _minAmountOut,
        address _beneficiary // ignore
    ) public override {
        IERC20(_from).safeTransferFrom(msg.sender, address(this), _amount);

        Route memory route = routes[_from][_to];
        uint256[] memory amounts = _getAmountsOut(_amount, route);
        uint256 amountOut = amounts[amounts.length - 1];
        require(
            amountOut >= _minAmountOut,
            "CurveSwapper: INSUFFICIENT_OUTPUT_AMOUNT"
        );

        for (uint256 i = 0; i < route.pools.length; i++) {
            ICurve(route.pools[i]).exchange(
                route.indexes[i.mul(2)],
                route.indexes[i.mul(2).add(1)],
                amounts[i],
                amounts[i]
            );
        }

        require(
            IERC20(_to).balanceOf(address(this)) >= amountOut,
            "CurveSwapper: INVALID_SWAP_RESULT"
        );
        IERC20(_to).safeTransfer(_beneficiary, amountOut);
    }
}
