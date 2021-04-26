// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;

import {StdQueue} from "../utils/Queue.sol";
import {Operator} from "../utils/Operator.sol";

interface IOperationStore {
    struct Info {
        address etherAddr;
        bytes32 terraAddr;
    }

    // getter
    function isIdleQueueEmpty() external view returns (bool);

    function getIdleOperation() external view returns (Info memory);

    function isFailedQueueEmpty() external view returns (bool);

    function getFailedOperation() external view returns (Info memory);

    function isRunningQueueEmpty() external view returns (bool);

    function getRunningOperation() external view returns (Info memory);

    // logics
    function allocate(Info memory info) external;

    function init(bool _autoFinish) external returns (address);

    function finish() external returns (address);

    function fail() external;

    function recover() external;

    function deallocate() external;
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
    StdQueue.Queue public optIdle;
    StdQueue.Queue public optFailed;
    StdQueue.Queue public optRunning;

    function isIdleQueueEmpty() public view override returns (bool) {
        return optIdle.isEmpty();
    }

    function getIdleOperation() public view override returns (Info memory) {
        return decodeOperation(optIdle.getItemAt(0));
    }

    function isFailedQueueEmpty() public view override returns (bool) {
        return optFailed.isEmpty();
    }

    function getFailedOperation() public view override returns (Info memory) {
        return decodeOperation(optFailed.getItemAt(0));
    }

    function isRunningQueueEmpty() public view override returns (bool) {
        return optRunning.isEmpty();
    }

    function getRunningOperation() public view override returns (Info memory) {
        return decodeOperation(optRunning.getItemAt(0));
    }

    // lifecycle

    // x -> init
    function allocate(Info memory info) public override onlyGranted {
        optIdle.produce(encodeOperation(info));
    }

    // init -> finish -> idle
    //      -> fail -> ~
    function init(bool _autoFinish)
        public
        override
        onlyGranted
        returns (address)
    {
        bytes memory rawInfo = optIdle.consume();
        if (_autoFinish) {
            optRunning.produce(rawInfo); // idle -> running
        }
        return decodeOperation(rawInfo).etherAddr;
    }

    function finish() public override onlyGranted returns (address) {
        bytes memory rawInfo = optRunning.consume();
        optIdle.produce(rawInfo); // running -> idle
        return decodeOperation(rawInfo).etherAddr;
    }

    // fail -> recover -> idle
    //      -> truncate -> x
    function fail() public override onlyGranted {
        optFailed.produce(optRunning.consume()); // running -> failed
    }

    function recover() public override onlyGranted {
        optIdle.produce(optFailed.consume()); // failed -> idle
    }

    function deallocate() public override onlyOwner {
        optFailed.consume(); // failed -> x
    }
}
