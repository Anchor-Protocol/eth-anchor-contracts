// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {
    IUniswapV2Router02
} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {IExchangeRateFeeder} from "./ExchangeRateFeeder.sol";
import {IRouter} from "../core/Router.sol";
import {Operator} from "../utils/Operator.sol";
import {IERC20Controlled, ERC20Controlled} from "../utils/ERC20Controlled.sol";

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

    // proxy settings
    IERC20 public proxyInputToken; // UST
    IERC20 public proxyOutputToken; // aUST
    uint256 public proxyReserve = 0; // aUST reserve

    IRouter public optRouter;
    ISwapper public swapRouter;
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
        address _swapRouter,
        address _exchangeRateFeeder
    ) public initializer {
        inputToken = IERC20(_inputToken);
        outputToken = new ERC20Controlled(_outputTokenName, _outputTokenSymbol);

        proxyInputToken = IERC20(_proxyInputToken);
        proxyOutputToken = IERC20(_proxyOutputToken);

        setSwapRouter(_swapRouter);
        setOperationRouter(_optRouter);
        setExchangeRateFeeder(_exchangeRateFeeder);
    }

    // governance

    function setSwapRouter(address _swapRouter) public onlyOwner {
        swapRouter = ISwapper(_swapRouter);
        inputToken.safeApprove(address(swapRouter), type(uint256).max);
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

    // operations
    function deposit(uint256 _amount) public override {
        inputToken.safeTransferFrom(msg.sender, address(this), _amount);

        // swap to UST
        swapRouter.swapTokens(
            address(inputToken),
            address(proxyInputToken),
            _amount
        );

        // depositStable
        uint256 ust = proxyInputToken.balanceOf(address(this));
        optRouter.depositStable(ust);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = ust.mul(1e18).div(pER);

        outputToken.mint(out);
        outputToken.safeTransfer(msg.sender, out);
    }

    function redeem(uint256 _amount) public override {
        outputToken.safeTransferFrom(msg.sender, address(this), _amount);
        outputToken.burn(_amount);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = _amount.mul(pER).div(1e18);

        uint256 aER = feeder.exchangeRateOf(address(proxyInputToken));
        uint256 redeemAmount = out.mul(1e18).div(aER);

        optRouter.redeemStable(msg.sender, redeemAmount);
    }
}
