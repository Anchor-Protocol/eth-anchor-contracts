// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;

import {StdQueue} from "./utils/Queue.sol";
import {Operator} from "./utils/Operator.sol";

contract OperationStore is Operator {
    using StdQueue for StdQueue.Queue;

    // operation
    struct OperationInfo {
        address etherAddr;
        bytes32 terraAddr;
    }

    function encodeOperation(OperationInfo memory info)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(info.etherAddr, info.terraAddr);
    }

    function decodeOperation(bytes memory rawInfo)
        internal
        pure
        returns (OperationInfo memory)
    {
        (address etherAddr, bytes32 terraAddr) =
            abi.decode(rawInfo, (address, bytes32));
        return OperationInfo({etherAddr: etherAddr, terraAddr: terraAddr});
    }

    // queues
    StdQueue.Queue public optIdle;
    StdQueue.Queue public optFailed;
    StdQueue.Queue public optRunning;

    function getIdleOperation() public view returns (OperationInfo memory) {
        return decodeOperation(optIdle.getItemAt(0));
    }

    function getFailedOperation() public view returns (OperationInfo memory) {
        return decodeOperation(optFailed.getItemAt(0));
    }

    function getRunningOperation() public view returns (OperationInfo memory) {
        return decodeOperation(optRunning.getItemAt(0));
    }

    // lifecycle

    // x -> init
    function allocate(OperationInfo memory info) public onlyOwner {
        optIdle.produce(encodeOperation(info));
    }

    // init -> finish -> idle
    //      -> fail -> ~
    function init() public onlyGranted {
        optRunning.produce(optIdle.consume()); // idle -> running
    }

    function finish() public onlyGranted {
        optIdle.produce(optRunning.consume()); // running -> idle
    }

    // fail -> recover -> idle
    //      -> truncate -> x
    function fail() public onlyGranted {
        optFailed.produce(optRunning.consume()); // running -> failed
    }

    function recover() public onlyGranted {
        optIdle.produce(optFailed.consume()); // failed -> idle
    }

    function deallocate() public onlyOwner {
        optFailed.consume(); // failed -> x
    }
}
