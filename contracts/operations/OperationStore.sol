// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {StdQueue} from "../utils/Queue.sol";
import {Operator} from "../utils/Operator.sol";
import {IOperation} from "./Operation.sol";

interface IOperationStore {
    // Events
    event OperationAllocated(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr
    );
    event OperationInitialized(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr,
        bool autoFinish
    );
    event OperationFinished(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr
    );
    event OperationFailed(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr
    );
    event OperationRecovered(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr
    );
    event OperationDeallocated(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr
    );
    event OperationFlushed(
        address indexed controller,
        address indexed operation,
        bytes32 indexed terraAddr,
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

    struct Info {
        address etherAddr;
        bytes32 terraAddr;
    }

    // getter
    function isIdleQueueEmpty() external view returns (bool);

    function getIdleOperationAt(uint256 _index)
        external
        view
        returns (Info memory);

    function isFailedQueueEmpty() external view returns (bool);

    function getFailedOperationAt(uint256 _index)
        external
        view
        returns (Info memory);

    function isRunningQueueEmpty() external view returns (bool);

    function getRunningOperationAt(uint256 _index)
        external
        view
        returns (Info memory);

    function getStatusOf(address _opt) external view returns (Status);

    // logics
    function allocate(Info memory info) external;

    function init(bool _autoFinish) external returns (address);

    function finish(address _opt) external;

    function fail(address _opt) external;

    function recover(address _opt) external;

    function deallocate(address _opt) external;

    function flush(Queue queue, uint256 _amount) external;

    function flushAll(uint256 _amount) external;
}

contract OperationStore is IOperationStore, Operator {
    using StdQueue for StdQueue.Queue;

    function encodeOperation(Info memory info)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(info.etherAddr, info.terraAddr);
    }

    function decodeOperation(bytes memory rawInfo)
        internal
        pure
        returns (Info memory)
    {
        (address etherAddr, bytes32 terraAddr) =
            abi.decode(rawInfo, (address, bytes32));
        return Info({etherAddr: etherAddr, terraAddr: terraAddr});
    }

    // queues
    mapping(address => Status) public optStat;

    StdQueue.Queue public optIdle;
    StdQueue.Queue public optFailed;
    StdQueue.Queue public optRunning;

    function isIdleQueueEmpty() public view override returns (bool) {
        return optIdle.isEmpty();
    }

    function getIdleOperationAt(uint256 _index)
        public
        view
        override
        returns (Info memory)
    {
        return decodeOperation(optIdle.getItemAt(_index));
    }

    function isFailedQueueEmpty() public view override returns (bool) {
        return optFailed.isEmpty();
    }

    function getFailedOperationAt(uint256 _index)
        public
        view
        override
        returns (Info memory)
    {
        return decodeOperation(optFailed.getItemAt(_index));
    }

    function isRunningQueueEmpty() public view override returns (bool) {
        return optRunning.isEmpty();
    }

    function getRunningOperationAt(uint256 _index)
        public
        view
        override
        returns (Info memory)
    {
        return decodeOperation(optRunning.getItemAt(_index));
    }

    function getStatusOf(address _opt) public view override returns (Status) {
        return optStat[_opt];
    }

    // lifecycle

    // x -> init
    function allocate(Info memory info) public override onlyGranted {
        optIdle.produce(encodeOperation(info));
        optStat[info.etherAddr] = Status.IDLE;
        emit OperationAllocated(msg.sender, info.etherAddr, info.terraAddr);
    }

    // init -> finish -> idle
    //      -> fail -> ~
    //      -> x (if autoFinish disabled)
    function init(bool _autoFinish)
        public
        override
        onlyGranted
        returns (address)
    {
        bytes memory rawInfo = optIdle.consume();
        Info memory info = decodeOperation(rawInfo);
        if (_autoFinish) {
            optRunning.produce(rawInfo); // idle -> running
            optStat[info.etherAddr] = Status.RUNNING_AUTO;
        } else {
            optStat[info.etherAddr] = Status.RUNNING_MANUAL;
        }
        emit OperationInitialized(
            msg.sender,
            info.etherAddr,
            info.terraAddr,
            _autoFinish
        );
        return info.etherAddr;
    }

    function finish(address _opt) public override onlyGranted {
        Status status = optStat[_opt];

        if (status == Status.RUNNING_MANUAL) {
            allocate(
                Info({
                    etherAddr: _opt,
                    terraAddr: IOperation(_opt).terraAddress()
                })
            );
            optStat[_opt] = Status.IDLE;
        } else if (status == Status.RUNNING_AUTO) {
            // wait for flush
            optStat[_opt] = Status.FINISHED;
        } else {
            revert("Router: invalid condition for finish operation");
        }

        emit OperationFinished(
            msg.sender,
            _opt,
            IOperation(_opt).terraAddress()
        );
    }

    // fail -> recover -> idle
    //      -> truncate -> x
    function fail(address _opt) public override onlyGranted {
        optStat[_opt] = Status.FAILED;
        emit OperationFailed(msg.sender, _opt, IOperation(_opt).terraAddress());
    }

    function flushRunningQueue(StdQueue.Queue storage _queue) internal {
        if (_queue.isEmpty()) {
            return;
        }

        Info memory info = decodeOperation(_queue.getItemAt(0));
        Status stat = optStat[info.etherAddr];
        if (stat == Status.FINISHED) {
            optIdle.produce(_queue.consume());
            emit OperationFlushed(
                msg.sender,
                info.etherAddr,
                info.terraAddr,
                Queue.RUNNING,
                Queue.IDLE
            );
        } else if (stat == Status.FAILED) {
            optFailed.produce(_queue.consume());
            emit OperationFlushed(
                msg.sender,
                info.etherAddr,
                info.terraAddr,
                Queue.RUNNING,
                Queue.FAILED
            );
        } else {
            return;
        }
    }

    function recover(address _opt) public override onlyGranted {
        optStat[_opt] = Status.RECOVERED;
        emit OperationRecovered(
            msg.sender,
            _opt,
            IOperation(_opt).terraAddress()
        );
    }

    function deallocate(address _opt) public override onlyOwner {
        optStat[_opt] = Status.DEALLOCATED;
        emit OperationDeallocated(
            msg.sender,
            _opt,
            IOperation(_opt).terraAddress()
        );
    }

    function flushFailedQueue(StdQueue.Queue storage _queue) internal {
        if (_queue.isEmpty()) {
            return;
        }

        Info memory info = decodeOperation(_queue.getItemAt(0));
        Status stat = optStat[info.etherAddr];
        if (stat == Status.RECOVERED) {
            optIdle.produce(_queue.consume());
            emit OperationFlushed(
                msg.sender,
                info.etherAddr,
                info.terraAddr,
                Queue.FAILED,
                Queue.IDLE
            );
        } else if (stat == Status.DEALLOCATED) {
            _queue.consume();
            emit OperationFlushed(
                msg.sender,
                info.etherAddr,
                info.terraAddr,
                Queue.FAILED,
                Queue.BLACKHOLE
            );
        } else {
            return;
        }
    }

    function _flush(
        StdQueue.Queue storage _queue,
        uint256 _amount,
        function(StdQueue.Queue storage) _handler
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
