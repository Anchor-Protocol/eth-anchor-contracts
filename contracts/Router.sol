// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {IFactory} from "./Factory.sol";
import {StdQueue} from "./utils/Queue.sol";
import {IOperation} from "./operations/Operation.sol";
import {IOperationStore} from "./operations/OperationStore.sol";

interface IRouter {
    function depositStable(uint256 _amount) external;

    function initDepositStable(uint256 _amount) external;

    function finishDepositStable(address _operation) external;

    function redeemStable(uint256 _amount) external;

    function initRedeemStable(uint256 _amount) external;

    function finishRedeemStable(address _operation) external;

    function fail(address _opt) external;

    function recover(address _opt, bool _runFinish) external;

    function emergencyWithdraw(address _opt, address _token) external;
}

contract Router is IRouter, Ownable, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // operation
    address public optStore;
    uint256 public optStdId;
    address public factory;

    // constant
    address public wUST;
    address public aUST;

    // acl
    address public bot;

    function initialize(
        address _optStore,
        uint256 _optStdId,
        address _wUST,
        address _aUST,
        address _factory
    ) public initializer {
        optStore = _optStore;
        optStdId = _optStdId;
        factory = _factory;
        wUST = _wUST;
        aUST = _aUST;
        bot = msg.sender;
    }

    function setOperationId(uint256 _optStdId) public onlyOwner {
        optStdId = _optStdId;
    }

    function setBotAddress(address _bot) public onlyOwner {
        bot = _bot;
    }

    function _init(
        IOperation.Type _typ,
        uint256 _amount,
        bool _autoFinish
    ) internal {
        IOperationStore store = IOperationStore(optStore);
        if (store.getAvailableOperation() == address(0x0)) {
            // deploy new one
            address instance = IFactory(factory).build(optStdId, address(this));
            store.allocate(instance);
            IERC20(wUST).safeApprove(instance, type(uint256).max);
            IERC20(aUST).safeApprove(instance, type(uint256).max);
        }
        IOperation operation = IOperation(store.init(_autoFinish));

        if (_typ == IOperation.Type.DEPOSIT) {
            IERC20(wUST).safeTransferFrom(msg.sender, address(this), _amount);
            operation.initDepositStable(msg.sender, _amount, _autoFinish);
            return;
        }

        if (_typ == IOperation.Type.REDEEM) {
            IERC20(aUST).safeTransferFrom(msg.sender, address(this), _amount);
            operation.initRedeemStable(msg.sender, _amount, _autoFinish);
            return;
        }

        revert("Router: invalid operation type");
    }

    function _finish(address _opt) internal {
        IOperationStore.Status status =
            IOperationStore(optStore).getStatusOf(_opt);

        if (status == IOperationStore.Status.RUNNING_MANUAL) {
            // check msg.sender
            require(
                IOperation(_opt).getCurrentStatus().operator == msg.sender,
                "Router: invalid sender"
            );
        } else if (status == IOperationStore.Status.RUNNING_AUTO) {
            // check msg.sender || bot
            require(
                IOperation(_opt).getCurrentStatus().operator == msg.sender ||
                    bot == msg.sender,
                "Router: invalid sender"
            );
        } else {
            revert("Router: invalid status for finish");
        }

        IOperation(_opt).finish();
        IOperationStore(optStore).finish(_opt);
    }

    function depositStable(uint256 _amount) public override {
        _init(IOperation.Type.DEPOSIT, _amount, true);
    }

    function initDepositStable(uint256 _amount) public override {
        _init(IOperation.Type.DEPOSIT, _amount, false);
    }

    function finishDepositStable(address _operation) public override {
        _finish(_operation);
    }

    function redeemStable(uint256 _amount) public override {
        _init(IOperation.Type.REDEEM, _amount, true);
    }

    function initRedeemStable(uint256 _amount) public override {
        _init(IOperation.Type.REDEEM, _amount, false);
    }

    function finishRedeemStable(address _operation) public override {
        _finish(_operation);
    }

    function fail(address _opt) public override {
        require(
            msg.sender == owner() || msg.sender == bot,
            "Router: access denied"
        );

        IOperation(_opt).fail();
        IOperationStore(optStore).fail(_opt);
    }

    function recover(address _opt, bool _runFinish) public override {
        require(
            msg.sender == owner() || msg.sender == bot,
            "Router: access denied"
        );

        IOperation(_opt).recover();
        IOperationStore(optStore).recover(_opt);

        if (_runFinish) {
            IOperation(_opt).finish();
        }
    }

    function emergencyWithdraw(address _opt, address _token)
        public
        override
        onlyOwner
    {
        IOperation(_opt).emergencyWithdraw(_token, msg.sender);
    }
}
