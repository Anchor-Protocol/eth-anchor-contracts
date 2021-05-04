// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {
    IUniswapV2Router02
} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {
    IUniswapV2Pair
} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import {IExchangeRateFeeder} from "./ExchangeRateFeeder.sol";
import {IRouter} from "../core/Router.sol";
import {Operator} from "../utils/Operator.sol";
import {IERC20Controlled, ERC20Controlled} from "../utils/ERC20Controlled.sol";
import {UniswapV2Library} from "../libraries/UniswapV2Library.sol";

interface ISwapper {
    function swapTokens(
        address _from,
        address _to,
        uint256 _amount
    ) external;
}

interface IConversionPool {
    function deposit(uint256 _amount) external;

    function redeem(uint256 _amount) external;
}

contract ConversionPool is IConversionPool, Operator, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Controlled;

    // pool token settings
    IERC20 public inputToken; // DAI / USDC / USDT
    IERC20Controlled public outputToken; // aDAI / aUSDC / aUSDT

    // swap settings
    address public swapFactory;
    address public bridgeToken;

    // proxy settings
    IERC20 public proxyInputToken; // UST
    IERC20 public proxyOutputToken; // aUST
    uint256 public proxyReserve = 0; // aUST reserve

    IRouter public optRouter;
    IExchangeRateFeeder public feeder;

    function initialize(
        // ===== tokens
        string memory _outputTokenName,
        string memory _outputTokenSymbol,
        address _inputToken,
        address _proxyInputToken,
        address _proxyOutputToken,
        // ===== others
        address _optRouter,
        address _swapFactory,
        address _exchangeRateFeeder
    ) public initializer {
        inputToken = IERC20(_inputToken);
        outputToken = new ERC20Controlled(_outputTokenName, _outputTokenSymbol);

        proxyInputToken = IERC20(_proxyInputToken);
        proxyOutputToken = IERC20(_proxyOutputToken);

        setSwapFactory(_swapFactory);
        setOperationRouter(_optRouter);
        setExchangeRateFeeder(_exchangeRateFeeder);
    }

    // governance

    function setBridgeToken(address _bridgeToken) public onlyOwner {
        bridgeToken = _bridgeToken;
    }

    function setSwapFactory(address _swapFactory) public onlyOwner {
        swapFactory = _swapFactory;
    }

    function setOperationRouter(address _optRouter) public onlyOwner {
        optRouter = IRouter(_optRouter);
        proxyInputToken.safeApprove(address(optRouter), type(uint256).max);
        proxyOutputToken.safeApprove(address(optRouter), type(uint256).max);
    }

    function setExchangeRateFeeder(address _exchangeRateFeeder)
        public
        onlyOwner
    {
        feeder = IExchangeRateFeeder(_exchangeRateFeeder);
    }

    // reserve

    function provideReserve(uint256 _amount) public onlyGranted {
        proxyReserve = proxyReserve.add(_amount);
        proxyOutputToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function removeReserve(uint256 _amount) public onlyGranted {
        proxyReserve = proxyReserve.sub(_amount);
        proxyOutputToken.safeTransfer(msg.sender, _amount);
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
                    ? UniswapV2Library.pairFor(swapFactory, output, path[i + 2])
                    : _to;
            IUniswapV2Pair(UniswapV2Library.pairFor(swapFactory, input, output))
                .swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function _swapToken(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
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
            UniswapV2Library.getAmountsOut(swapFactory, _amount, path);
        require(
            amounts[amounts.length - 1] >= 0,
            "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            UniswapV2Library.pairFor(swapFactory, path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, address(this));
    }

    // operations
    function deposit(uint256 _amount) public override {
        // swap to UST
        _swapToken(address(inputToken), address(proxyInputToken), _amount);

        // depositStable
        uint256 ust = proxyInputToken.balanceOf(address(this));
        optRouter.depositStable(ust);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        outputToken.mint(msg.sender, ust.mul(1e18).div(pER));
    }

    function redeem(uint256 _amount) public override {
        outputToken.burnFrom(msg.sender, _amount);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = _amount.mul(pER).div(1e18);

        uint256 aER = feeder.exchangeRateOf(address(proxyInputToken));
        optRouter.redeemStable(msg.sender, out.mul(1e18).div(aER));
    }
}
