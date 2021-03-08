# Anchor Ethereum Wrapping Contracts (`EthAnchor`)

`EthAnchor` is a set of Ethereum-side contracts that wrap around Anchor’s UST deposit flow to be accessible from Ethereum. It works alongside with `anchor-ether-bot` to forward and automate any deposits and withdrawal requests being made on Ethereum to the Terra blockchain.

### Considerations

**Interchain operations on Anchor are non-atomic.** For example, when depositing Ethereum UST to Anchor Protocol, the following operations must be consecutively executed:

    * Transfer UST from Ethereum to a specified Terra address over a token transfer bridge, such as Wormhole or Shuttle.
    * `anchor-ether-bot` keeps a record of token lock events and deposit contract events on Ethereum.
    * `anchor-ether-bot` runs the `deposit_stable{}` `ExecuteMsg` on the Anchor money market contracts and receives aUST.
    * aUST is sent back to the original Ethereum depositor address over a token transfer bridge.

On a typical Ethereum Dapp, as all operations are atomic & transactionality is preserved, the result of a deposit operation would immediately return either:

* transaction succeeded
* transaction failed (for whatever reason)

after the transaction is mined. However, as Anchor’s core logic lives on the Terra blockchain and there is no state-level synchronization, there is no atomic guarantee of the outcome of the transaction. For example

* the contract does not know whether interchain token transfers for either UST or aUST has succeeded
* the contract does not know whether `deposit_stable{}` has succeeded
* there is a possibility that `anchor-ether-bot` itself has failed, and the contract has no knowledge of it

thus, to handle exception cases due to this non-atomicity, the contract is configured as follows:

* all operations are paired with separate `init` - `finish` contract calls. a caller should call `init` first to invoke an operation, and then call `finish` to finalize the operation.
* no additional `init` calls can be made before an operation pair is finalized with a `finish` call. for example, a new `initDepositStable()` call cannot be made before `finishDepositStable()` is invoked.

### Contract Specification

Anchor's Ethereum wrapper contract is a client-specifically generated smart contract on the Ethereum blockchain to handle wrapped UST deposits to Anchor Protocol. Both depositing wrapped UST and redeeming wrapped aUST is processed with an `init` - `finish` architecture. It is important to note that additional processing time (separate from time required for Ethereum tx confirmation) is needed in order for `init` requests, until which `finish` requests will result in failure.
Additionally, wrapper contracts can only process requests in series, allowing an additional request to be made only after the finish operation for the previous request was successfully executed.

Anchor Ethereum wrapper contracts have two execution modes: **standard** and **custodied**. **Standard** mode functions return aUST back to `msg.sender`, in which they can be potentially utilized with other Ethereum DeFi applications. **Custodied** mode functions do not return aUST back to `msg.sender`, but only holds aUST under the contract account. As there can be only one custody contract per authorized account, redeeming custodied aUST back to UST can be done at any time as long as the sender is authorized.

### **Events**

### `InitDeposit`

Emitted when wrapped UST is requested for deposit to Anchor via `initDepositStable`.

`event InitDeposit(address indexed sender, uint256 amount, bytes32 to);`


### ******`FinishDeposit`******

Emitted when wrapped aUST is claimed from Anchor via `finishDepositStable`.

`event FinishDeposit(address indexed sender);`


### ******`InitRedeem`******

Emitted when wrapped aUST is requested for redemption to Anchor via `initRedeemStable`.

`event InitRedeem(address indexed sender, uint256 amount, bytes32 to);`


### ******`FinishRedeem`******

Emitted when wrapped UST is claimed from Anchor via `finishRedeemStable`.

`event FinishDeposit(address indexed sender);`


### ******`EmergencyWithdrawActivated`******

Emitted when `emergencyWithdraw` is activated for withdrawing ERC-20 tokens from the contract.

`event EmergencyWithdrawActivated(address tokenAddress, uint256 amount);`


### Functions

### `initDepositStable`

Accepts new wrapped UST deposits.

`function initDepositStable(uint256 amount) external;`

**Prerequisite**: must have called `approve()` for an `allowance` of at least `amount` for the wrapped UST contract, `ActionFlag` is set to `false` 
**Accepts**: `amount` - how much UST to deposit 
**Updates**: `ActionFlag` to `true` 
**Emits**: `InitDeposit`

### `finishDepositStable`

Claims resulting wrapped aUST after deposit.

`// standard mode`
`function finishDepositStable() external;`

**Prerequisite**: aUST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false`, `transfer`s all aUST balances from contract address to `tx.origin` 
**Emits**: `FinishDeposit`

`// custodied mode`
`function finishDepositStableCustody() external;`

**Prerequisite**: aUST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false` 
**Emits**: `FinishDeposit`

`// fallback function`
`function finishDepositStable(bool _isCustodyEnabled) external;`

**Prerequisite**: aUST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Checks**: `_isCustodyEnabled`. If this value is set to `true`, `delegatecall`s `finishDepositStableCustody`. Otherwise, `delegatecall`s `finishDepositStable`. 
**Emits**: `FinishDeposit`

### `initRedeemStable`

Accepts wrapped aUST for redemption back to wrapped UST.

`// standard mode`
`function initRedeemStable(uint256 amount) external;`

**Prerequisite**: must have called `approve()` for an allowance of at least `amount` for the wrapped aUST contract, `ActionFlag` is set to `false` 
**Accepts**: `amount` - how much aUST to redeem back to UST 
**Updates**: `ActionFlag` to `true`
**IMPORTANT**: aUST redemptions may fail if UST buffer is low on the Terra side Anchor money market → be sure to check account contract balances & `initRedeemStable()` `success` parameters. 
**Emits**: `InitRedemption`

`// custodied mode`
`function initRedeemStableCustody(uint256 amount) external;`

**Prerequisite**: `ActionFlag` is set to `false` 
**Accepts**: `amount` - how much aUST to redeem back to UST. If this value is set to 0, all balances held within the contract are redeemed back to UST. Otherwise, `amount` aUST held under the contract account is redeemed back to UST (assuming that contract aUST balances is equal to or larger than `amount`). 
**Updates**: `ActionFlag` to `true`
**IMPORTANT**: aUST redemptions may fail if UST buffer is low on the Terra side Anchor money market → be sure to check account contract balances & `initRedeemStable()` `success` parameters. 
**Emits**: `InitRedemption`

`// fallback function`
`function initRedeemStableCustody(uint256 amount, bool _isCustodyEnabled) external;`

**Prerequisite**: `ActionFlag` is set to `false` 
**Accepts**: `amount` - how much aUST to redeem back to UST. If this value is set to 0, all balances held within the contract; `_isCustodyEnabled` - an indicator to which mode `amount` should be passed as a parameter to. 
**Checks**: `_isCustodyEnabled`. If this value is set to `true`, `delegatecall`s `initRedeemStableCustody`. Otherwise, `delegatecall`s `initRedeemStable`. 
**Emits**: `InitRedemption`


### ******`finishRedeemStable`******

Claims resulting wrapped UST after withdrawal.

`function finishRedeemStable() external;`

**Prerequisite**: UST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false`, transfers all UST balances from contract address to `tx.origin` 
**Emits**: `FinishRedemption`


### ******`reportFailure`******

Reports any failures in-between `init` operations to allow the AnchorEth bot to return any funds, and reset `ActionFlag`back to `false`. Only callable by contract owner.

`function reportFailure() external;`

**Prerequisite**: UST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false`, transfers all UST balances from contract address to `tx.origin` 
**Emits**: `FinishRedemption`


### ******`emergencyWithdraw`******

Withdraws all balances of any ERC-20 token from the contract address. Only callable by contract owner.

`function emergencyWithdraw(address _tokenAddress) external;`

**Prerequisite**: ERC-20 token balances of token contract `_tokenAddress` at contract address must be greater than 0
**Updates**: transfers all ERC-20 token balances of token contract `_tokenAddress` back to `msg.sender`
