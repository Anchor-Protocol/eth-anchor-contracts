// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

library StdQueue {
    struct Queue {
        uint256 index;
        uint256 size;
        mapping(uint256 => bytes) store;
    }

    function isEmpty(Queue storage q) internal view returns (bool) {
        return q.size == 0;
    }

    function getItemAt(Queue storage q, uint256 index)
        internal
        view
        returns (bytes memory)
    {
        return q.store[q.index + index];
    }

    function produce(Queue storage q, bytes memory data) internal {
        q.store[q.index + q.size] = data;
        q.size += 1;
    }

    function consume(Queue storage q) internal returns (bytes memory) {
        require(!isEmpty(q), "StdQueue: empty queue");
        bytes memory data = getItemAt(q, 0);
        q.index += 1;
        q.size -= 1;
        return data;
    }
}
