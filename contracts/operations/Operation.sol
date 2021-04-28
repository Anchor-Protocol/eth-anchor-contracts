// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {WrappedAsset} from "../assets/WrappedAsset.sol";

interface IOperation {
    // Events
    event AutoFinishEnabled(address indexed operation);
    event InitDeposit(address indexed operator, uint256 amount, bytes32 to);
    event FinishDeposit(address indexed operator, uint256 amount);
    event InitRedemption(address indexed operator, uint256 amount, bytes32 to);
    event FinishRedemption(address indexed operator, uint256 amount);
    event EmergencyWithdrawActivated(address token, uint256 amount);

    // Data Structure
    enum Status {IDLE, RUNNING, STOPPED}
    enum Type {NEUTRAL, DEPOSIT, REDEEM}

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

    function finish() external;

    function finishDepositStable() external;

    function finishRedeemStable() external;

    function fail() external;

    function recover() external;

    function emergencyWithdraw(address _token, address _to) external;
}

// Operation.sol: subcontract generated per wallet, defining all relevant wrapping functions
contract Operation is Ownable, IOperation, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
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
    ) private checkStopped {
        require(currentStatus.status == Status.IDLE, "Operation: running");
        require(_amount >= 10 ether, "Operation: amount must be more than 10");

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

            emit InitDeposit(_operator, _amount, terraAddress);
        } else if (_typ == Type.REDEEM) {
            currentStatus.input = address(aUST);
            currentStatus.output = address(wUST);

            aUST.safeTransferFrom(msg.sender, address(this), _amount);
            aUST.burn(_amount, terraAddress);

            emit InitRedemption(_operator, _amount, terraAddress);
        } else {
            revert("Operation: invalid operation type");
        }

        if (_autoFinish) {
            emit AutoFinishEnabled(address(this));
        }
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
        _init(Type.REDEEM, _operator, _amount, _autoFinish);
    }

    function _finish() private checkStopped returns (address, uint256) {
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
        } else if (typ == Type.REDEEM) {
            emit FinishRedemption(operator, amount);
        }

        // reset
        currentStatus = DEFAULT_STATUS;

        return (address(output), amount);
    }

    function finish() public override onlyController {
        _finish();
    }

    function finishDepositStable() public override onlyController {
        _finish();
    }

    function finishRedeemStable() public override onlyController {
        _finish();
    }

    function fail() public override onlyController {
        currentStatus.status = Status.STOPPED;
    }

    function recover() public override onlyController {
        if (currentStatus.operator == address(0x0)) {
            currentStatus.status = Status.IDLE;
        } else {
            currentStatus.status = Status.RUNNING;
        }
    }

    function emergencyWithdraw(address _token, address _to)
        public
        override
        onlyController
    {
        require(
            currentStatus.status == Status.STOPPED,
            "Operation: not an emergency"
        );

        IERC20(_token).safeTransfer(
            _to,
            IERC20(_token).balanceOf(address(this))
        );
    }
}
