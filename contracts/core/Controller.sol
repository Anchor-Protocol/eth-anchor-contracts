// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {Operator} from "../utils/Operator.sol";
import {IOperation} from "../operations/Operation.sol";
import {IOperationStore} from "../operations/OperationStore.sol";
import {IOperationFactory} from "../operations/OperationFactory.sol";

interface IController {
    function allocate(uint256 _amount) external;

    function flush(uint256 _amount) external;

    function halt(address _opt) external;

    function recover(address _opt, bool _runFinish) external;

    function emergencyWithdraw(address _opt, address _token) external;
}

contract Controller is IController, Context, Operator {
    using SafeERC20 for IERC20;

    address public wUST;
    address public aUST;

    uint256 public optStdId;
    address public optStore;
    address public optFactory;

    function _finish(address _opt) internal {
        IOperationStore.Status status =
            IOperationStore(optStore).getStatusOf(_opt);

        require(
            status == IOperationStore.Status.RUNNING_AUTO &&
                operator == super._msgSender(),
            "Controller: invalid sender"
        );

        IOperation(_opt).finish();
        IOperationStore(optStore).finish(_opt);
    }

    function allocate(uint256 _amount) public override onlyGranted {
        for (uint256 i = 0; i < _amount; i++) {
            // deploy new one
            address instance =
                IOperationFactory(optFactory).build(optStdId, address(this));
            IOperationStore(optStore).allocate(instance);
            IERC20(wUST).safeApprove(instance, type(uint256).max);
            IERC20(aUST).safeApprove(instance, type(uint256).max);
        }
    }

    function flush(uint256 _amount) public override onlyGranted {
        IOperationStore(optStore).flushAll(_amount);
    }

    function halt(address _opt) public override onlyGranted {
        IOperation(_opt).halt();
        IOperationStore(optStore).halt(_opt);
    }

    function recover(address _opt, bool _runFinish)
        public
        override
        onlyGranted
    {
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
        IOperation(_opt).emergencyWithdraw(_token, super._msgSender());
    }
}
