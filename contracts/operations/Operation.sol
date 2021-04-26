// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {WrappedAsset} from "../assets/WrappedAsset.sol";

interface IOperation {
    // Events
    event InitDeposit(
        address indexed sender,
        uint256 amount,
        bytes32 to,
        bool autoFinish
    );
    event FinishDeposit(address indexed sender, uint256 amount);
    event InitRedemption(
        address indexed sender,
        uint256 amount,
        bytes32 to,
        bool autoFinish
    );
    event FinishRedemption(address indexed sender, uint256 amount);
    event FailureReported();
    event EmergencyWithdrawActivated(address tokenAddress, uint256 amount);

    // Enums
    enum Status {IDLE, RUNNING, STOPPED}
    enum Type {NEUTRAL, DEPOSIT, WITHDRAW}

    // Data Structure
    struct Info {
        Status status;
        Type typ;
        address operator;
        uint256 amount;
        address input;
        address output;
    }

    // Interfaces
    function controller() external view returns (address);

    function terraAddress() external view returns (bytes32);

    function getCurrentStatus() external view returns (Info memory);

    function initDepositStable(
        address _operator,
        uint256 _amount,
        bool _autoFinish
    ) external;

    function initRedeemStable(
        address _operator,
        uint256 _amount,
        bool _autoFinish
    ) external;

    function finishDepositStable() external;

    function finishRedeemStable() external;

    function emergencyWithdraw(address _tokenAddress) external;
}

// Operation.sol: subcontract generated per wallet, defining all relevant wrapping functions
contract Operation is Ownable, IOperation, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for WrappedAsset;

    Info public DEFAULT_STATUS =
        Info({
            status: Status.IDLE,
            typ: Type.NEUTRAL,
            operator: address(0x0),
            amount: 0,
            input: address(0x0),
            output: address(0x0)
        });
    Info public currentStatus;

    WrappedAsset public wUST;
    WrappedAsset public aUST;

    address public override controller;
    bytes32 public override terraAddress;

    function initialize(bytes memory args) public initializer {
        (
            address _controller,
            bytes32 _terraAddress,
            address _wUST,
            address _aUST
        ) = abi.decode(args, (address, bytes32, address, address));

        currentStatus = DEFAULT_STATUS;
        controller = _controller;
        terraAddress = _terraAddress;
        wUST = WrappedAsset(_wUST);
        aUST = WrappedAsset(_aUST);
    }

    function initPayload(address, bytes32 _terraAddress)
        public
        view
        returns (bytes memory)
    {
        return abi.encode(controller, _terraAddress, wUST, aUST);
    }

    modifier onlyController {
        require(controller == msg.sender, "Operation: not allowed");

        _;
    }

    modifier checkStopped {
        require(currentStatus.status != Status.STOPPED, "Operation: stopped");

        _;
    }

    function getCurrentStatus() public view override returns (Info memory) {
        return currentStatus;
    }

    function _init(
        Type _typ,
        address _operator,
        uint256 _amount,
        bool _autoFinish
    ) private {
        require(currentStatus.status == Status.IDLE, "Operation: busy");

        currentStatus = Info({
            status: Status.RUNNING,
            typ: _typ,
            operator: _operator,
            amount: _amount,
            input: address(0x0),
            output: address(0x0)
        });

        if (_typ == Type.DEPOSIT) {
            currentStatus.input = address(wUST);
            currentStatus.output = address(aUST);

            wUST.safeTransferFrom(msg.sender, address(this), _amount);
            wUST.burn(_amount, terraAddress);

            emit InitDeposit(_operator, _amount, terraAddress, _autoFinish);
            return;
        }

        if (_typ == Type.WITHDRAW) {
            currentStatus.input = address(aUST);
            currentStatus.output = address(wUST);

            aUST.safeTransferFrom(msg.sender, address(this), _amount);
            aUST.burn(_amount, terraAddress);

            emit InitRedemption(_operator, _amount, terraAddress, _autoFinish);
            return;
        }

        revert("Operation: invalid operation type");
    }

    function initDepositStable(
        address _operator,
        uint256 _amount,
        bool _autoFinish
    ) public override onlyController {
        _init(Type.DEPOSIT, _operator, _amount, _autoFinish);
    }

    function initRedeemStable(
        address _operator,
        uint256 _amount,
        bool _autoFinish
    ) public override onlyController {
        _init(Type.WITHDRAW, _operator, _amount, _autoFinish);
    }

    function _finish() private {
        // check status
        require(currentStatus.status == Status.RUNNING, "Operation: idle");

        WrappedAsset output = WrappedAsset(currentStatus.output);
        uint256 amount = output.balanceOf(address(this));
        address operator = currentStatus.operator;

        require(amount > 0, "Operation: not enough token");
        output.safeTransfer(operator, amount);

        // prevent multiple reference
        Type typ = currentStatus.typ;

        if (typ == Type.DEPOSIT) {
            emit FinishDeposit(operator, amount);
        } else if (typ == Type.WITHDRAW) {
            emit FinishRedemption(operator, amount);
        }

        // reset
        currentStatus = DEFAULT_STATUS;
    }

    function finishDepositStable() public override onlyController {
        _finish();
    }

    function finishRedeemStable() public override onlyController {
        _finish();
    }

    function emergencyWithdraw(address _tokenAddress)
        public
        override
        onlyController
    {
        // TODO: finish logic
    }
}
