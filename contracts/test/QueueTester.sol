// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {StdQueue} from "../utils/Queue.sol";

contract QueueTester {
    using StdQueue for StdQueue.Queue;

    StdQueue.Queue public queue;

    function isEmpty() public view returns (bool) {
        return queue.isEmpty();
    }

    function getItemAt(uint256 _index) public view returns (bytes memory) {
        return queue.getItemAt(_index);
    }

    function produce(bytes memory _data) public {
        queue.produce(_data);
    }

    function consume() public {
        emit Consumed(queue.consume());
    }

    event Consumed(bytes);
}
