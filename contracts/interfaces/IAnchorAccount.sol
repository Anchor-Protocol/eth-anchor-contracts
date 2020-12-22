// IAnchorAccount.sol: Interface for wrapping around Anchor deposit subcontracts
pragma solidity >=0.6.0 <0.8.0;

interface IAnchorAccount {
    function initDeposit(uint256 amount, bytes32 to) external;
    function finishDeposit(uint256 amount) external;
    function initRedemption(uint256 amount, bytes32 to) external;
    function finishRedemption(uint256 amount) external;
    function transferOwnership(address newOwner) external virtual;
}