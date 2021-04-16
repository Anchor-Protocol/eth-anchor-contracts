// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "./interfaces/IShuttleAsset.sol";
import "./interfaces/IAnchorAccount.sol";

import {Operation} from "./Operation.sol";

contract Router is Ownable, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => address) public ContractMap;

    AnchorAccount[] private ContractsList;
    IShuttleAsset public terrausd;
    IShuttleAsset public anchorust;

    function initialize(address _terrausd, address _anchorust)
        public
        initializer
    {
        terrausd = IShuttleAsset(_terrausd);
        anchorust = IShuttleAsset(_anchorust);
    }

    // **MUST** be called after calling openzeppelin upgradable_contract_deploy_proxy
    function migrate(address newContract, address[] memory contracts)
        public
        onlyOwner
    {
        // migrate subcontract ownership to new contract
        for (uint256 i = 0; i < contracts.length; i++) {
            IAnchorAccount(contracts[i]).transferOwnership(newContract);
        }
    }

    // setters
    function setUSTAddress(IShuttleAsset _terrausd) public onlyOwner {
        terrausd = _terrausd;
    }

    function setaUSTAddress(IShuttleAsset _anchorust) public onlyOwner {
        anchorust = _anchorust;
    }

    // getters
    function getContractAddress(address _sender) public view returns (address) {
        return ContractMap[_sender];
    }

    function deployContract(address _walletAddress) public onlyOwner {
        // create new contract
        AnchorAccount accountContract = new AnchorAccount();
        accountContract.initialize(
            address(this),
            msg.sender,
            _walletAddress,
            address(terrausd),
            address(anchorust)
        );
        // append to map
        ContractMap[_walletAddress] = address(accountContract);
        ContractsList.push(accountContract);
        // emit contractdeployed event
        emit ContractDeployed(address(accountContract), _walletAddress);
    }

    function reportFailure() public onlyOwner {
        IAnchorAccount(ContractMap[msg.sender]).reportFailure();
    }

    // Events
    event ContractDeployed(address account, address sender);
}
