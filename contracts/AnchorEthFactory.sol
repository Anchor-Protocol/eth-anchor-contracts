// SPDX-License-Identifier: UNLICENSED
// AnchorEthFactory.sol: Factory contract for all account contracts
pragma solidity >=0.6.0 <0.8.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/IShuttleAsset.sol';
import './interfaces/IAnchorAccount.sol';

contract AnchorEthFactory is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => address) public ContractMap;

    AnchorAccount[] private ContractsList;
    IShuttleAsset public terrausd;
    IShuttleAsset public anchorust;

    bool public isMigrated = false;

    constructor(address _terrausd, address _anchorust) {
        terrausd = IShuttleAsset(_terrausd);
        anchorust = IShuttleAsset(_anchorust);
    }

    // **MUST** be called after calling openzeppelin upgradable_contract_deploy_proxy
    function migrate(address newContract) public onlyOwner {
        require(isMigrated == false, "AnchorEthFactory: contract already migrated");
        // migrate subcontract ownership to new contract
        for (uint i = 0; i < ContractsList.length; i++) {
            ContractsList[i].transferOwnership(newContract);
        }
        isMigrated = true;
    }

    // setters
    function setUSTAddess(IShuttleAsset _terrausd) public onlyOwner {
        terrausd = _terrausd;
    }

    function setaUSTAddress(IShuttleAsset _anchorust) public onlyOwner {
        anchorust = _anchorust;
    }

    // getters
    function getContractAddress(address _sender) public returns (address) {
        return ContractMap[_sender];
    }

    function deployContract(address _walletAddress) onlyOwner public {
        // create new contract
        AnchorAccount accountContract = new AnchorAccount(address(this), _walletAddress, address(terrausd), address(anchorust));
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

// AnchorAccount.sol: subcontract generated per wallet, defining all relevant wrapping functions

contract AnchorAccount is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IShuttleAsset public terrausd;
    IShuttleAsset public anchorust;

    address public anchorFactory;
    address public controllerAddress;
    address public walletAddress;
    bytes32 public terraAddress;
    bool private ActionFlag = false;

    constructor(address _anchorFactory, address _walletAddress, address _terrausd, address _anchorust) {
        anchorFactory = _anchorFactory;
        walletAddress = _walletAddress;
        terrausd = IShuttleAsset(_terrausd);
        anchorust = IShuttleAsset(_anchorust);
    }

    modifier checkInit() {
        require(ActionFlag == false, "AnchorAccount: init operation: init already called");
        _;
    }

    modifier checkFinish() {
        require(ActionFlag == true, "AnchorAccount: finish operation: init not called yet");
        _;
    }

    modifier onlyAuthSender() {
        require(walletAddress == msg.sender || controllerAddress == msg.sender, "AnchorAccount: unauthorized sender");
        _;
    }
    
    modifier onlyController() {
        require(controllerAddress == msg.sender, "AnchorAccount: only callable by controller");
        _;
    }

    modifier terraAddressSet() {
        require(terraAddress[0] != 0, "AnchorAccount: Terra address not initialized");
        _;
    }

    function setTerraAddress(bytes32 _terraAddress) public onlyController {
        terraAddress = _terraAddress;
    }

    function getTerraAddress() public returns (bytes32) {
        return terraAddress;
    }

    function initDepositStable(uint256 amount) public onlyAuthSender checkInit terraAddressSet {    
        require(amount > 0, "AnchorAccount: amount must be greater than 0");    
        // transfer UST to contract address
        terrausd.transferFrom(msg.sender, address(this), amount);

        // transfer UST to Shuttle
        terrausd.burn(amount, terraAddress);

        // set ActionFlag to true
        ActionFlag = true;

        // emit initdeposit event
        emit InitDeposit(msg.sender, amount, terraAddress);
    }

    function finishDepositStable() public checkFinish terraAddressSet {
        // contract holds returned aUST
        // call will fail if aUST was not returned from Shuttle/Anchorbot/Terra contracts
        require(anchorust.balanceOf(address(this)) > 0, "AnchorAccount: finish deposit operation: not enough aust");
        // anchorust.transfer(walletAddress, anchorust.balanceOf(address(this)));

        // set ActionFlag to false
        ActionFlag = false;

        // emit finishdeposit event
        emit FinishDeposit(walletAddress);
    }

    function initRedeemStable() public onlyAuthSender checkInit terraAddressSet {
        require(anchorust.balanceOf(address(this)) > 0, "AnchorAccount: amount must be greater than 0");
        // anchorust.transferFrom(msg.sender, address(this), amount);

        // transfer aUST to Shuttle
        anchorust.burn(anchorust.balanceOf(address(this), terraAddress);

        // set ActionFlag to true
        ActionFlag = true;

        // emit initredemption event
        emit InitRedemption(msg.sender, amount, terraAddress);
    }

    function finishRedeemStable() public onlyAuthSender checkFinish terraAddressSet {
        // transfer UST to msg.sender
        // call will fail if aUST was not returned from Shuttle/Anchorbot/Terra contracts
        require(terrausd.balanceOf(address(this)) > 0, "AnchorAccount: finish redemption operation: not enough ust");
        terrausd.transfer(walletAddress, terrausd.balanceOf(address(this)));
        
        // set ActionFlag to false
        ActionFlag = false;

        // emit finishredemption event
        emit FinishRedemption(walletAddress);
    }

    function reportFailure() public onlyController checkInit {
        // contract owner can force revert init() txs in case of aUST redemption failure
        // resets ActionFlag and return deposited funds to msg.sender
        require(terrausd.balanceOf(address(this)) == 0 && ActionFlag == true, "AnchorAccount: call finish first");
        ActionFlag = false;
    }

    // Events
    event InitDeposit(address sender, uint256 amount, bytes32 to);
    event FinishDeposit(address sender);
    event InitRedemption(address sender, uint256 amount, bytes32 to);
    event FinishRedemption(address sender);
}