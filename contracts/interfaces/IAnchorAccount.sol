// IAnchorAccount.sol: Interface for wrapping around Anchor deposit subcontracts
pragma solidity >=0.6.0 <0.8.0;

interface IAnchorAccount {
    function initDeposit(uint256 amount, bytes32 to) external;
    function finishDeposit() external;
    function initRedemption(uint256 amount, bytes32 to) external;
    function finishRedemption() external;
    function transferOwnership(address newOwner) external virtual;
}