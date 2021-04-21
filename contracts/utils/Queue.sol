// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

library StdQueue {
    struct Queue {
        uint256 index;
        uint256 size;
        mapping(uint256 => bytes32) store;
    }

    function produce(Queue storage q, bytes32 data) internal {
        q.store[q.index + q.size] = data;
        q.size += 1;
    }

    function consume(Queue storage q) internal returns (bytes32) {
        bytes32 data = q.store[q.index];
        q.index += 1;
        q.size -= 1;
        return data;
    }
}
