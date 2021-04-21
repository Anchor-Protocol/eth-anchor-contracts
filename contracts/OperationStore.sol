// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;

import {StdQueue} from "./utils/Queue.sol";

contract OperationStore {
    using StdQueue for StdQueue.Queue;

    // operation struct
    struct OperationInfo {
        address addr;
        address occupier;
    }

    function encodeOperation(OperationInfo memory info)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(info.addr, info.occupier);
    }

    function decodeOperation(bytes memory rawInfo)
        internal
        pure
        returns (OperationInfo memory)
    {
        (address addr, address occupier) =
            abi.decode(rawInfo, (address, address));
        return OperationInfo({addr: addr, occupier: occupier});
    }

    // queue
    StdQueue.Queue public idleOperations;
    StdQueue.Queue public failedOperations;
    StdQueue.Queue public runningOperations;

    function getIdleOperation(bool _consume)
        public
        returns (OperationInfo memory)
    {
        if (_consume) {
            return decodeOperation(idleOperations.consume());
        } else {
            return decodeOperation(idleOperations.getItemAt(0));
        }
    }

    function getFailedOperation(bool _consume)
        public
        returns (OperationInfo memory)
    {
        if (_consume) {
            return decodeOperation(failedOperations.consume());
        } else {
            return decodeOperation(failedOperations.getItemAt(0));
        }
    }

    function getRunningOperation(bool _consume)
        public
        returns (OperationInfo memory)
    {
        if (_consume) {
            return decodeOperation(runningOperations.consume());
        } else {
            return decodeOperation(runningOperations.getItemAt(0));
        }
    }
}
