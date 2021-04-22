// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import "../assets/WrappedAsset.sol";

// Operation.sol: subcontract generated per wallet, defining all relevant wrapping functions
contract Operation is Ownable, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    WrappedAsset public input;
    WrappedAsset public output;

    address public deployer;
    address public controllerAddress;
    address public walletAddress;
    bytes32 public terraAddress;
    bool private ActionFlag = false;

    constructor() {
        deployer = msg.sender;
    }

    function initialize(
        address _controllerAddress,
        address _walletAddress,
        bytes32 _terraAddress,
        address _input,
        address _output
    ) public initializer {
        controllerAddress = _controllerAddress;
        walletAddress = _walletAddress;
        terraAddress = _terraAddress;
        input = WrappedAsset(_input);
        output = WrappedAsset(_output);
    }

    function initDepositStable(uint256 amount) public {}

    function finishDepositStable() public {}

    function initRedeemStable(uint256 amount) public {}

    function finishRedeemStable() public {}

    function reportFailure() public {}

    function emergencyWithdraw(address _tokenAddress) public {}

    // Events
    event InitDeposit(address indexed sender, uint256 amount, bytes32 to);
    event FinishDeposit(address indexed sender);
    event InitRedemption(address indexed sender, uint256 amount, bytes32 to);
    event FinishRedemption(address indexed sender);
    event FailureReported();
    event EmergencyWithdrawActivated(address tokenAddress, uint256 amount);
}
