// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";

import {IFactory} from "./Factory.sol";
import {StdQueue} from "./utils/Queue.sol";
import {IOperation} from "./operations/Operation.sol";
import {IOperationStore} from "./operations/OperationStore.sol";

contract Router is Ownable, Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => IOperation.Status) public optStatus;
    address public optStore;
    uint256 public optId;

    address public wUST;
    address public aUST;
    address public factory;

    function initialize(
        address _optStore,
        uint256 _optId,
        address _wUST,
        address _aUST,
        address _factory
    ) public initializer {
        optStore = _optStore;
        optId = _optId;
        wUST = _wUST;
        aUST = _aUST;
        factory = _factory;
    }

    function _init(
        IOperation.Type _typ,
        uint256 _amount,
        bool _autoFinish
    ) internal {
        IOperationStore store = IOperationStore(optStore);
        if (store.isIdleQueueEmpty()) {
            // deploy new one
            address instance = IFactory(factory).build(optId, address(this));
            store.allocate(
                IOperationStore.Info({
                    etherAddr: instance,
                    terraAddr: IOperation(instance).terraAddr()
                })
            );
        }
        IOperation operation = IOperation(store.init(_autoFinish));
    }

    function depositStable(uint256 _amount) public {}

    function initDepositStable() public {}

    function finishDepositStable(address _operation) public {}

    function deployContract(address _walletAddress) public onlyOwner {
        // create new contract
        Operation accountContract = new Operation();
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
