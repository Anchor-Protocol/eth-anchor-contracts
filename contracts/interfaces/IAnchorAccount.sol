// IAnchorAccount.sol: Interface for wrapping around Anchor deposit subcontracts
pragma solidity >=0.6.0 <0.8.0;

interface IAnchorAccount {
    function initDepositStable(uint256 amount, bytes32 to) external;
    function finishDepositStable() external;
    function initRedeemStable(uint256 amount, bytes32 to) external;
    function finishRedeemStable() external;
    function transferOwnership(address newOwner) external virtual;
}