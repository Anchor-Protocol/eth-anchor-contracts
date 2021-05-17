// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {
    IUniswapV2Pair
} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import {IExchangeRateFeeder} from "./ExchangeRateFeeder.sol";
import {IRouter} from "../core/Router.sol";
import {Operator} from "../utils/Operator.sol";
import {ISwapper} from "../swapper/ISwapper.sol";
import {IERC20Controlled, ERC20Controlled} from "../utils/ERC20Controlled.sol";
import {UniswapV2Library} from "../libraries/UniswapV2Library.sol";

interface IConversionPool {
    function deposit(uint256 _amount) external;

    function redeem(uint256 _amount) external;
}

contract ConversionPool is IConversionPool, Context, Operator, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IERC20Controlled;

    // pool token settings
    IERC20 public inputToken; // DAI / USDC / USDT
    IERC20Controlled public outputToken; // aDAI / aUSDC / aUSDT

    // swap settings
    ISwapper public swapper;

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
        address _swapper,
        address _exchangeRateFeeder
    ) public initializer {
        inputToken = IERC20(_inputToken);
        outputToken = new ERC20Controlled(_outputTokenName, _outputTokenSymbol);

        proxyInputToken = IERC20(_proxyInputToken);
        proxyOutputToken = IERC20(_proxyOutputToken);

        setSwapper(_swapper);
        setOperationRouter(_optRouter);
        setExchangeRateFeeder(_exchangeRateFeeder);
    }

    // governance

    function setSwapper(address _swapper) public onlyOwner {
        swapper = ISwapper(_swapper);
        inputToken.safeApprove(address(swapper), type(uint256).max);
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
        proxyOutputToken.safeTransferFrom(
            super._msgSender(),
            address(this),
            _amount
        );
    }

    function removeReserve(uint256 _amount) public onlyGranted {
        proxyReserve = proxyReserve.sub(_amount);
        proxyOutputToken.safeTransfer(super._msgSender(), _amount);
    }

    // operations

    function deposit(uint256 _amount) public override {
        inputToken.safeTransferFrom(super._msgSender(), address(this), _amount);

        // swap to UST
        swapper.swapToken(
            address(inputToken),
            address(proxyInputToken),
            _amount,
            address(this)
        );

        // depositStable
        uint256 ust = proxyInputToken.balanceOf(address(this));
        optRouter.depositStable(ust);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        outputToken.mint(super._msgSender(), ust.mul(1e18).div(pER));
    }

    function redeem(uint256 _amount) public override {
        outputToken.burnFrom(super._msgSender(), _amount);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = _amount.mul(pER).div(1e18);

        uint256 aER = feeder.exchangeRateOf(address(proxyInputToken));
        optRouter.redeemStable(
            super._msgSender(),
            out.mul(1e18).div(aER),
            address(swapper),
            address(inputToken)
        );
    }
}
