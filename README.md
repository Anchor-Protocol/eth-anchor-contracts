# Anchor Ethereum Wrapping Contracts (`EthAnchor`)

`EthAnchor` is a set of Ethereum-side contracts that wrap around Anchor’s UST deposit flow to be accessible from Ethereum. It works alongside with `eth-anchor-bot` to forward and automate any deposits and withdrawal requests being made on Ethereum to the Terra blockchain.

## Considerations

**Interchain operations on Anchor are non-atomic.** For example, when depositing Ethereum UST to Anchor Protocol, the following operations must be consecutively executed:

    * Transfer UST from Ethereum to a specified Terra address over a token transfer bridge, such as Wormhole or Shuttle.
    * `eth-anchor-bot` keeps a record of token lock events and deposit contract events on Ethereum.
    * `eth-anchor-bot` runs the `deposit_stable{}` `ExecuteMsg` on the Anchor money market contracts and receives aUST.
    * aUST is sent back to the original Ethereum depositor address over a token transfer bridge.

On a typical Ethereum Dapp, as all operations are atomic & transactionality is preserved, the result of a deposit operation would immediately return either:

- transaction succeeded
- transaction failed (for whatever reason)

after the transaction is mined. However, as Anchor’s core logic lives on the Terra blockchain and there is no state-level synchronization, there is no atomic guarantee of the outcome of the transaction. For example

- the contract does not know whether interchain token transfers for either UST or aUST has succeeded
- the contract does not know whether `deposit_stable{}` has succeeded
- there is a possibility that `eth-anchor-bot` itself has failed, and the contract has no knowledge of it

thus, to handle exception cases due to this non-atomicity, the contract is configured as follows:

- all operations are paired with separate `init` - `finish` contract calls. a caller should call `init` first to invoke an operation, and then call `finish` to finalize the operation.
- no additional `init` calls can be made before an operation pair is finalized with a `finish` call. for example, a new `initDepositStable()` call cannot be made before `finishDepositStable()` is invoked.

## Contract List

### Core

- [Controller](./contracts/core/Controller.sol)
- [Router](./contracts/core/Router.sol)

### Operation

- [Operation](./contracts/operations/Operation.sol)
- [OperationACL](./contracts/operations/OperationACL.sol)
- [OperationFactory](./contracts/operations/OperationFactory.sol)
- [OperationStore](./contracts/operations/OperationStore.sol)

### Extension

- [ConversionPool](./contracts/extensions/ConversionPool.sol)
- [ExchangeRateFeeder](./contracts/extensions/ExchangeRateFeeder.sol)

## Setup

### deps

```bash
$ git clone https://github.com/anchor-protocol/eth-anchor-contracts

$ cd eth-anchor-contracts

$ yarn
```

### config

- add `local.config.ts` beside `hardhat.config.ts` with this template

```typescript
export const Networks = {
  ropsten: {
    url: "https://ropsten.infura.io/v3/{api_key}",
    accounts: ["{private_key_1}", "{private_key_2}", "{private_key_3}"],
  },
  mainnet: {
    url: "https://mainnet.infura.io/v3/{api_key}",
    accounts: ["{private_key_1}", "{private_key_2}", "{private_key_3}"],
  },
};

export const EtherscanAPIKey = "{api_key}";
```

### Commands

```bash
$ yarn compile      # compile project

$ yarn test         # test project

$ yarn coverage     # test project with coverage

$ yarn deploy-core  # deploy core contracts (Operation, Store, Factory, Router, Controller...)

$ yarn deploy-exts  # deploy extension contracts (ConversionPool, ExchangeRateFeeder...)
```

## License

**MIT**

<!-- # Anchor Ethereum Wrapping Contracts (`EthAnchor`)

`EthAnchor` is a set of Ethereum-side contracts that wrap around Anchor’s UST deposit flow to be accessible from Ethereum. It works alongside with `anchor-ether-bot` to forward and automate any deposits and withdrawal requests being made on Ethereum to the Terra blockchain.

### Considerations

**Interchain operations on Anchor are non-atomic.** For example, when depositing Ethereum UST to Anchor Protocol, the following operations must be consecutively executed:

    * Transfer UST from Ethereum to a specified Terra address over a token transfer bridge, such as Wormhole or Shuttle.
    * `anchor-ether-bot` keeps a record of token lock events and deposit contract events on Ethereum.
    * `anchor-ether-bot` runs the `deposit_stable{}` `ExecuteMsg` on the Anchor money market contracts and receives aUST.
    * aUST is sent back to the original Ethereum depositor address over a token transfer bridge.

On a typical Ethereum Dapp, as all operations are atomic & transactionality is preserved, the result of a deposit operation would immediately return either:

- transaction succeeded
- transaction failed (for whatever reason)

after the transaction is mined. However, as Anchor’s core logic lives on the Terra blockchain and there is no state-level synchronization, there is no atomic guarantee of the outcome of the transaction. For example

- the contract does not know whether interchain token transfers for either UST or aUST has succeeded
- the contract does not know whether `deposit_stable{}` has succeeded
- there is a possibility that `anchor-ether-bot` itself has failed, and the contract has no knowledge of it

thus, to handle exception cases due to this non-atomicity, the contract is configured as follows:

- all operations are paired with separate `init` - `finish` contract calls. a caller should call `init` first to invoke an operation, and then call `finish` to finalize the operation.
- no additional `init` calls can be made before an operation pair is finalized with a `finish` call. for example, a new `initDepositStable()` call cannot be made before `finishDepositStable()` is invoked.

### Contract Specification

Anchor's Ethereum wrapper contract is a client-specifically generated smart contract on the Ethereum blockchain to handle wrapped UST deposits to Anchor Protocol. Both depositing wrapped UST and redeeming wrapped aUST is processed with an `init` - `finish` architecture. It is important to note that additional processing time (separate from time required for Ethereum tx confirmation) is needed in order for `init` requests, until which `finish` requests will result in failure.
Additionally, wrapper contracts can only process requests in series, allowing an additional request to be made only after the finish operation for the previous request was successfully executed.

Anchor Ethereum wrapper contracts have two execution modes: **standard**. **Standard** mode functions return aUST back to `msg.sender`, in which they can be potentially utilized with other Ethereum DeFi applications.

### **Events**

### `InitDeposit`

Emitted when wrapped UST is requested for deposit to Anchor via `initDepositStable`.

`event InitDeposit(address indexed sender, uint256 amount, bytes32 to);`

### **\*\***`FinishDeposit`**\*\***

Emitted when wrapped aUST is claimed from Anchor via `finishDepositStable`.

`event FinishDeposit(address indexed sender);`

### **\*\***`InitRedeem`**\*\***

Emitted when wrapped aUST is requested for redemption to Anchor via `initRedeemStable`.

`event InitRedeem(address indexed sender, uint256 amount, bytes32 to);`

### **\*\***`FinishRedeem`**\*\***

Emitted when wrapped UST is claimed from Anchor via `finishRedeemStable`.

`event FinishDeposit(address indexed sender);`

### **\*\***`EmergencyWithdrawActivated`**\*\***

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

### `initRedeemStable`

Accepts wrapped aUST for redemption back to wrapped UST.

`// standard mode`
`function initRedeemStable(uint256 amount) external;`

**Prerequisite**: must have called `approve()` for an allowance of at least `amount` for the wrapped aUST contract, `ActionFlag` is set to `false`
**Accepts**: `amount` - how much aUST to redeem back to UST
**Updates**: `ActionFlag` to `true`
**IMPORTANT**: aUST redemptions may fail if UST buffer is low on the Terra side Anchor money market → be sure to check account contract balances & `initRedeemStable()` `success` parameters.
**Emits**: `InitRedemption`

### **\*\***`finishRedeemStable`**\*\***

Claims resulting wrapped UST after withdrawal.

`function finishRedeemStable() external;`

**Prerequisite**: UST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false`, transfers all UST balances from contract address to `tx.origin`
**Emits**: `FinishRedemption`

### **\*\***`reportFailure`**\*\***

Reports any failures in-between `init` operations to allow the AnchorEth bot to return any funds, and reset `ActionFlag`back to `false`. Only callable by contract owner.

`function reportFailure() external;`

**Prerequisite**: UST balance of account-specific endpoint contract must be greater than 0, `ActionFlag` is set to `true`
**Updates**: sets `ActionFlag` to `false`, transfers all UST balances from contract address to `tx.origin`
**Emits**: `FinishRedemption`

### **\*\***`emergencyWithdraw`**\*\***

Withdraws all balances of any ERC-20 token from the contract address. Only callable by contract owner.

`function emergencyWithdraw(address _tokenAddress) external;`

**Prerequisite**: ERC-20 token balances of token contract `_tokenAddress` at contract address must be greater than 0
**Updates**: transfers all ERC-20 token balances of token contract `_tokenAddress` back to `msg.sender` -->
