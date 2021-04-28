// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {EnumerableSet} from "@openzeppelin/contracts/utils/EnumerableSet.sol";

import {StdQueue} from "../utils/Queue.sol";
import {Operator} from "../utils/Operator.sol";
import {IOperation} from "./Operation.sol";

interface IOperationStore {
    // Events
    event OperationAllocated(
        address indexed controller,
        address indexed operation
    );
    event OperationInitialized(
        address indexed controller,
        address indexed operation,
        bool autoFinish
    );
    event OperationFinished(
        address indexed controller,
        address indexed operation
    );
    event OperationFailed(
        address indexed controller,
        address indexed operation
    );
    event OperationRecovered(
        address indexed controller,
        address indexed operation
    );
    event OperationDeallocated(
        address indexed controller,
        address indexed operation
    );
    event OperationFlushed(
        address indexed controller,
        address indexed operation,
        Queue from,
        Queue to
    );

    // Data Structure
    enum Status {
        IDLE,
        RUNNING_AUTO,
        RUNNING_MANUAL,
        FINISHED,
        FAILED,
        RECOVERED,
        DEALLOCATED
    }

    enum Queue {IDLE, RUNNING, FAILED, BLACKHOLE}

    // getter
    function getAvailableOperation() external view returns (address);

    function getFailedOperationAt(uint256 _index)
        external
        view
        returns (address);

    function getRunningOperationAt(uint256 _index)
        external
        view
        returns (address);

    function getStatusOf(address _opt) external view returns (Status);

    // logics
    function allocate(address _opt) external;

    function init(bool _autoFinish) external returns (address);

    function finish(address _opt) external;

    function fail(address _opt) external;

    function recover(address _opt) external;

    function deallocate(address _opt) external;

    function flush(Queue queue, uint256 _amount) external;

    function flushAll(uint256 _amount) external;
}

contract OperationStore is IOperationStore, Operator {
    using StdQueue for StdQueue.AddressQueue;
    using EnumerableSet for EnumerableSet.AddressSet;

    // queues
    mapping(address => Status) public optStat;

    EnumerableSet.AddressSet internal optIdle;
    StdQueue.AddressQueue internal optFailed;
    StdQueue.AddressQueue internal optRunning;

    function getAvailableOperation() public view override returns (address) {
        return optIdle.at(0);
    }

    function getFailedOperationAt(uint256 _index)
        public
        view
        override
        returns (address)
    {
        return optFailed.getItemAt(_index);
    }

    function getRunningOperationAt(uint256 _index)
        public
        view
        override
        returns (address)
    {
        return optRunning.getItemAt(_index);
    }

    function getStatusOf(address _opt) public view override returns (Status) {
        return optStat[_opt];
    }

    // lifecycle

    // x -> init
    function allocate(address _opt) public override onlyGranted {
        optIdle.add(_opt);
        optStat[_opt] = Status.IDLE;
        emit OperationAllocated(msg.sender, _opt);
    }

    // =========================== RUNNING QUEUE OPERATIONS =========================== //

    // init -> finish -> idle
    //      -> fail -> ~
    //      -> x (if autoFinish disabled)
    function init(bool _autoFinish)
        public
        override
        onlyGranted
        returns (address)
    {
        // consume
        address opt = optIdle.at(0);
        optIdle.remove(opt);

        if (_autoFinish) {
            optRunning.produce(opt); // idle -> running
            optStat[opt] = Status.RUNNING_AUTO;
        } else {
            optStat[opt] = Status.RUNNING_MANUAL;
        }

        emit OperationInitialized(msg.sender, opt, _autoFinish);
        return opt;
    }

    // =========================== RUNNING QUEUE OPERATIONS =========================== //

    function finish(address _opt) public override onlyGranted {
        Status status = optStat[_opt];

        if (status == Status.RUNNING_MANUAL) {
            allocate(_opt);
        } else if (status == Status.RUNNING_AUTO) {
            // wait for flush
            optStat[_opt] = Status.FINISHED;
        } else {
            revert("Router: invalid condition for finish operation");
        }

        emit OperationFinished(msg.sender, _opt);
    }

    // fail -> recover -> idle
    //      -> truncate -> x
    function fail(address _opt) public override onlyGranted {
        Status stat = optStat[_opt];
        if (stat == Status.IDLE) {
            // push to failed queue
            optIdle.remove(_opt);
            optFailed.produce(_opt);
        } else {
            // wait for flush
            optStat[_opt] = Status.FAILED;
        }
        emit OperationFailed(msg.sender, _opt);
    }

    function flushRunningQueue(StdQueue.AddressQueue storage _queue) internal {
        if (_queue.isEmpty()) {
            return;
        }

        address opt = _queue.getItemAt(0);
        Status stat = optStat[opt];
        if (stat == Status.FINISHED) {
            optIdle.add(_queue.consume());
            optStat[opt] = Status.IDLE;
            emit OperationFlushed(msg.sender, opt, Queue.RUNNING, Queue.IDLE);
        } else if (stat == Status.FAILED) {
            optFailed.produce(_queue.consume());
            emit OperationFlushed(msg.sender, opt, Queue.RUNNING, Queue.FAILED);
        } else {
            return;
        }
    }

    // =========================== FAIL QUEUE OPERATIONS =========================== //

    function recover(address _opt) public override onlyGranted {
        optStat[_opt] = Status.RECOVERED;
        emit OperationRecovered(msg.sender, _opt);
    }

    function deallocate(address _opt) public override onlyOwner {
        optStat[_opt] = Status.DEALLOCATED;
        emit OperationDeallocated(msg.sender, _opt);
    }

    function flushFailedQueue(StdQueue.AddressQueue storage _queue) internal {
        if (_queue.isEmpty()) {
            return;
        }

        address opt = _queue.getItemAt(0);
        Status stat = optStat[opt];
        if (stat == Status.RECOVERED) {
            optIdle.add(_queue.consume());
            optStat[opt] = Status.IDLE;
            emit OperationFlushed(msg.sender, opt, Queue.FAILED, Queue.IDLE);
        } else if (stat == Status.DEALLOCATED) {
            _queue.consume();
            emit OperationFlushed(
                msg.sender,
                opt,
                Queue.FAILED,
                Queue.BLACKHOLE
            );
        } else {
            return;
        }
    }

    function _flush(
        StdQueue.AddressQueue storage _queue,
        uint256 _amount,
        function(StdQueue.AddressQueue storage) _handler
    ) internal {
        for (uint256 i = 0; i < _amount; i++) {
            _handler(_queue);
        }
    }

    function flush(Queue _queue, uint256 _amount) public override onlyGranted {
        if (_queue == Queue.RUNNING) {
            _flush(optRunning, _amount, flushRunningQueue);
        } else if (_queue == Queue.FAILED) {
            _flush(optRunning, _amount, flushFailedQueue);
        } else {
            revert("OperationStore: invalid queue type");
        }
    }

    function flushAll(uint256 _amount) public override onlyGranted {
        flush(Queue.RUNNING, _amount);
        flush(Queue.FAILED, _amount);
    }
}
