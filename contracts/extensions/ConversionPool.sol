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

    // swap
    address public weth;

    // proxy settings
    IERC20 public proxyInputToken; // UST
    IERC20 public proxyOutputToken; // aUST
    uint256 public proxyReserve; // aUST reserve

    IRouter public router;
    IUniswapV2Router02 public uniRouter;
    IExchangeRateFeeder public feeder;

    function initialize(
        // ===== tokens
        string memory _outputTokenName,
        string memory _outputTokenSymbol,
        address _inputToken,
        address _weth,
        address _proxyInputToken,
        address _proxyOutputToken,
        // ===== others
        address _router,
        address _uniRouter,
        address _exchangeRateFeeder
    ) public initializer {
        inputToken = IERC20(_inputToken);
        outputToken = new ERC20Controlled(_outputTokenName, _outputTokenSymbol);

        weth = _weth;

        proxyInputToken = IERC20(_proxyInputToken);
        proxyOutputToken = IERC20(_proxyOutputToken);

        router = IRouter(_router);
        proxyInputToken.safeApprove(address(router), type(uint256).max);
        proxyOutputToken.safeApprove(address(router), type(uint256).max);

        uniRouter = IUniswapV2Router02(_uniRouter);
        inputToken.safeApprove(address(uniRouter), type(uint256).max);

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
    function _swapUniswap(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        require(_to != address(0));

        address[] memory path;

        if (_from == weth || _to == weth) {
            path = new address[](2);
            path[0] = _from;
            path[1] = _to;
        } else {
            path = new address[](3);
            path[0] = _from;
            path[1] = weth;
            path[2] = _to;
        }

        uniRouter.swapExactTokensForTokens(
            _amount,
            0,
            path,
            address(this),
            block.timestamp.add(60)
        );
    }

    function deposit(uint256 _amount) public override {
        inputToken.safeTransferFrom(msg.sender, address(this), _amount);

        // swap to UST
        _swapUniswap(address(inputToken), address(proxyInputToken), _amount);

        // depositStable
        uint256 ust = proxyInputToken.balanceOf(address(this));
        router.depositStable(ust);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = pER.mul(1e18).div(ust);

        outputToken.mint(out);
        outputToken.safeTransfer(msg.sender, out);
    }

    function redeem(uint256 _amount) public override {
        outputToken.safeTransferFrom(msg.sender, address(this), _amount);
        outputToken.burn(_amount);

        uint256 pER = feeder.exchangeRateOf(address(inputToken));
        uint256 out = pER.mul(_amount).div(1e18);

        uint256 aER = feeder.exchangeRateOf(address(proxyInputToken));
        uint256 redeemAmount = aER.mul(1e18).div(out);

        router.redeemStable(msg.sender, redeemAmount);
    }
}
