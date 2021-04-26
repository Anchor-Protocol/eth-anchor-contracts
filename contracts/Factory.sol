// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

interface OperationStandard {
    function initialize(bytes memory) external;

    function initPayload(address, bytes32) external view returns (bytes memory);
}

interface IFactory {
    function build(uint256 _optId, address _controller)
        external
        returns (address);
}

contract Factory is Ownable {
    // permission
    mapping(address => bool) public permission;

    function allow(address _target) public onlyOwner {
        permission[_target] = true;
    }

    function deny(address _target) public onlyOwner {
        permission[_target] = false;
    }

    function isPermissioned(address _target) public view returns (bool) {
        return permission[_target];
    }

    // standard operations
    mapping(uint256 => address) internal standards;

    function setStandardOperation(uint256 _optId, address _operation)
        public
        onlyOwner
    {
        standards[_optId] = _operation;
    }

    function build(uint256 _optId, address _controller)
        public
        returns (address)
    {
        require(isPermissioned(msg.sender), "Factory: not allowed");

        address instance = Clones.clone(standards[_optId]);
        bytes memory payload =
            OperationStandard(standards[_optId]).initPayload(_controller, 0x0); // TODO: make terraAddress buffer
        OperationStandard(instance).initialize(payload);

        return instance;
    }
}
