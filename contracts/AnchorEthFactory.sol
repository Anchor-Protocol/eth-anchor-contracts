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

    modifier contractExists() {
        require(ContractMap[tx.origin] != address(0x0), "AnchorEthFactory: subcontract does not exist");
        _;
    }

    // **MUST** be called after calling openzeppelin upgradable_contract_deploy_proxy
    function migrate(address newContract) public onlyOwner {
        // migrate subcontract ownership to new contract
        for (uint i = 0; i < ContractsList.length; i++) {
            ContractsList[i].transferOwnership(newContract);
        }
        isMigrated = true;
    }

    function setUSTAddess(IShuttleAsset _terrausd) public onlyOwner {
        terrausd = _terrausd;
    }

    function setaUSTAddress(IShuttleAsset _anchorust) public onlyOwner {
        anchorust = _anchorust;
    }

    function initDepositStable(uint256 amount) public contractExists {
        IAnchorAccount(ContractMap[msg.sender]).initDepositStable(amount);
    }

    function finishDepositStable() public contractExists {
        IAnchorAccount(ContractMap[msg.sender]).finishDepositStable();
    }

    function initRedeemStable(uint256 amount) public contractExists {
        IAnchorAccount(ContractMap[msg.sender]).initRedeemStable(amount);
    }

    function finishRedeemStable() public contractExists {
        IAnchorAccount(ContractMap[msg.sender]).finishRedeemStable();
    }

    function deployContract() onlyOwner public {
        // create new contract
        AnchorAccount accountContract = new AnchorAccount(address(this), msg.sender, terrausd, anchorust);
        // append to map
        ContractMap[msg.sender] = address(accountContract);
        ContractsList.push(accountContract);
        // emit contractdeployed event
        emit ContractDeployed(address(accountContract), msg.sender);
    }

    // Events
    event ContractDeployed(address account, address sender);
}

// SPDX-License-Identifier: UNLICENSED
// AnchorAccount.sol: subcontract generated per wallet, defining all relevant wrapping functions

contract AnchorAccount is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IShuttleAsset public terrausd;
    IShuttleAsset public anchorust;

    address public anchorFactory;
    address public walletAddress;
    bytes32 public terraAddress;
    bool private ActionFlag = false;

    constructor(address _anchorFactory, address _walletAddress, IShuttleAsset _terrausd, IShuttleAsset _anchorust) {
        anchorFactory = _anchorFactory;
        walletAddress = _walletAddress;
        terrausd = _terrausd;
        anchorust = _anchorust;
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
        require(walletAddress == tx.origin, "AnchorAccount: unauthorized sender");
        _;
    }

    modifier terraAddressSet() {
        require(terraAddress[0] != 0, "AnchorAccount: Terra address not initialized");
        _;
    }

    function setTerraAddress(bytes32 _terraAddress) public onlyAuthSender {
        terraAddress = _terraAddress;
    }

    function initDepositStable(uint256 amount) public onlyAuthSender checkInit terraAddressSet {        
        // transfer UST to contract address
        terrausd.transferFrom(msg.sender, address(this), amount);

        // transfer UST to Shuttle
        terrausd.burn(amount, terraAddress);

        // set ActionFlag to true
        ActionFlag = true;

        // emit initdeposit event
        emit InitDeposit(tx.origin, amount, terraAddress);
    }

    function finishDepositStable() public onlyAuthSender checkFinish terraAddressSet {
        // transfer aUST to msg.sender
        // call will fail if aUST was not returned from Shuttle/Anchorbot/Terra contracts
        require(anchorust.balanceOf(address(this)) > 0, "AnchorAccount: finish deposit operation: not enough aust");
        anchorust.transfer(msg.sender, anchorust.balanceOf(address(this)));

        // set ActionFlag to false
        ActionFlag = false;

        // emit finishdeposit event
        emit FinishDeposit(tx.origin);
    }

    function initRedeemStable(uint256 amount) public onlyAuthSender checkInit terraAddressSet {
        // transfer aUST to contract address
        anchorust.transferFrom(msg.sender, address(this), amount);

        // transfer aUST to Shuttle
        anchorust.burn(amount, terraAddress);

        // set ActionFlag to true
        ActionFlag = true;

        // emit initredemption event
        emit InitRedemption(tx.origin, amount, terraAddress);
    }

    function finishRedeemStable() public onlyAuthSender checkFinish terraAddressSet {
        // transfer UST to msg.sender
        // call will fail if aUST was not returned from Shuttle/Anchorbot/Terra contracts
        require(terrausd.balanceOf(address(this)) > 0, "AnchorAccount: finish redemption operation: not enough ust");
        terrausd.transfer(msg.sender, terrausd.balanceOf(address(this)));
        
        // set ActionFlag to false
        ActionFlag = false;

        // emit finishredemption event
        emit FinishRedemption(tx.origin);
    }

    // Events
    event InitDeposit(address sender, uint256 amount, bytes32 to);
    event FinishDeposit(address sender);
    event InitRedemption(address sender, uint256 amount, bytes32 to);
    event FinishRedemption(address sender);
}