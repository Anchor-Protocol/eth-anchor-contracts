import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils, Signer } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

chai.use(solidity);

describe('EthAnchorFactory', () => {
    const ETH = utils.parseEther('1');
    const DEPOSIT_AMOUNT = ETH.mul(100);

    const { provider } = ethers;

    // testing environment setup

    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    before('setting up accounts', async () => {
        [ deployer, user ] = await ethers.getSigners();
    });

    let TerraUSD: ContractFactory;
    let AnchorUST: ContractFactory;
    let EthAnchorFactory: ContractFactory;
    let AnchorAccount: ContractFactory;

    before('initialize ContractFactory', async () => {
        TerraUSD = await ethers.getContractFactory('TerraUSD');
        AnchorUST = await ethers.getContractFactory('AnchorUST');
        EthAnchorFactory = await ethers.getContractFactory('EthAnchorFactory');
        AnchorAccount = await ethers.getContractFactory('AnchorAccount');
    });

    let terra_usd: Contract;
    let anchor_ust: Contract;
    let anchor_eth_factory: Contract;
    let anchor_account: Contract;

    beforeEach('deploy all contracts', async () => {
        terra_usd = await TerraUSD.connect(deployer).deploy();
        anchor_ust = await AnchorUST.connect(deployer).deploy();
        //anchor_eth_factory = await EthAnchorFactory.connect(deployer).deploy(
        //    terra_usd.address,
        //    anchor_ust.address
        //);
        anchor_eth_factory = await EthAnchorFactory.connect(deployer).deploy();
        await anchor_eth_factory.connect(deployer).initialize(
            terra_usd.address,
            anchor_ust.address
        );
        //anchor_account = await AnchorAccount.connect(deployer).deploy(
        //    anchor_eth_factory.address,
        //    deployer.address,
        //    user.address,
        //    terra_usd.address,
        //    anchor_ust.address
        //);
        anchor_account = await AnchorAccount.connect(deployer).deploy();
        await anchor_account.connect(deployer).initialize(
            anchor_eth_factory.address,
            deployer.address,
            user.address,
            terra_usd.address,
            anchor_ust.address
        );
    });

    // core testing logic

    describe('#initialization', () => {
        it('should work for new subcontract deployments', async () => {
            await expect(anchor_eth_factory.connect(deployer).deployContract(user.address))
            .to.emit(anchor_eth_factory, 'ContractDeployed');
        });

        it('should fail when caller is not the owner', async () => {
            await expect(anchor_eth_factory.connect(user).deployContract(user.address))
            .to.reverted;
        });
    });

    describe('#deposit', () => {
        it('should fail for finish functions when init is not called yet', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(deployer)['finishDepositStable(bool)'](false))
            .to.revertedWith('AnchorAccount: finish operation: init not called yet');
        });

        it('should work for initializer functions', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT))
            .to.emit(anchor_account, 'InitDeposit')
            .withArgs(
                user.address,
                DEPOSIT_AMOUNT, 
                '0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'
            );
        });

        it('should fail for initializer functions when finish is not called yet', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT))
            .to.revertedWith('AnchorAccount: init operation: init already called');
        });

        it('should fail for non-custodial finish functions when there is not enough balance', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
            ]);
            await expect(anchor_account.connect(user)['finishDepositStable(bool)'](false))
            .to.revertedWith('AnchorAccount: finish deposit operation: not enough aust')
        });

        it('should fail for custodial finish functions when there is not enough balance', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
            ]);
            await expect(anchor_account.connect(deployer)['finishDepositStable(bool)'](true))
            .to.revertedWith('AnchorAccount: custody mode: finish deposit operation: not enough aust');
        });

        it('should work for non-custodial finish functions', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(user)['finishDepositStable(bool)'](false))
            .to.emit(anchor_account, 'FinishDeposit')
            .withArgs(user.address);
        });

        it('should work for custodial finish functions', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(deployer)['finishDepositStable(bool)'](true))
            .to.emit(anchor_account, 'FinishDeposit')
            .withArgs(user.address);
        });
    });

    describe('#withdrawal', () => {
        it('should fail for finish functions when init is not called yet', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user).finishRedeemStable())
            .to.revertedWith('AnchorAccount: finish operation: init not called yet');
        });

        it('should work for non-custodial initializer functions', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_ust.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(user)['initRedeemStable(uint256,bool)'](DEPOSIT_AMOUNT, false))
            .to.emit(anchor_account, 'InitRedemption')
            .withArgs(
                user.address,
                DEPOSIT_AMOUNT, 
                '0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'
            );
        });

        it('should work for custodial initializer functions when aust balance is partially redeemed', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user)['initRedeemStable(uint256,bool)'](ETH.mul(10), true))
            .to.emit(anchor_account, 'InitRedemption')
            .withArgs(
                user.address,
                ETH.mul(10), 
                '0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'
            );
        });

        it('should work for custodial initializer functions when aust balance is fully redeemed', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user)['initRedeemStable(uint256,bool)'](0, true))
            .to.emit(anchor_account, 'InitRedemption')
            .withArgs(
                user.address,
                DEPOSIT_AMOUNT, 
                '0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'
            );
        });

        it('should fail for custodial initializer functions when requested aust balance exceeds current contract balance', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user)['initRedeemStable(uint256,bool)'](ETH.mul(1000), true))
            .to.revertedWith('AnchorAccount: custody mode: amount must be smaller than current contract balance');
        });

        it('should fail for initializer functions when finish is not called yet', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(deployer)['initRedeemStable(uint256,bool)'](0, true),
            ]);

            await expect(anchor_account.connect(user)['initRedeemStable(uint256,bool)'](0, false))
            .to.revertedWith('AnchorAccount: init operation: init already called');
        });

        it('should fail for finish functions when there is not enough balance', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_ust.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(user)['initRedeemStable(uint256,bool)'](DEPOSIT_AMOUNT, false),
            ]);

            await expect(anchor_account.connect(deployer).finishRedeemStable())
            .to.revertedWith('AnchorAccount: finish redemption operation: not enough ust');
        });

        it('should work for finish functions', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_ust.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(user)['initRedeemStable(uint256,bool)'](DEPOSIT_AMOUNT, false),
                terra_usd.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(user).finishRedeemStable())
            .to.emit(anchor_account, 'FinishRedemption')
            .withArgs(user.address);
        });
    });

    describe('#exceptions', () => {
        it('should work for reportFailure calls', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(deployer)['initRedeemStable(uint256,bool)'](0, true),
            ]);
            await expect(anchor_account.connect(deployer).reportFailure())
            .to.emit(anchor_account, 'FailureReported');
        });

        it('should fail for reportFailure calls not made by controller', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(deployer)['initRedeemStable(uint256,bool)'](0, true),
            ]);
            await expect(anchor_account.connect(user).reportFailure())
            .to.reverted;
        });

        it('should fail for reportFailure calls without an init call', async () => {
            await expect(anchor_account.connect(user).reportFailure())
            .to.reverted;
        });

        it('should work for emergencyWithdraw calls for UST', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);
            await expect(anchor_account.connect(deployer).emergencyWithdraw(terra_usd.address))
            .to.emit(anchor_account, 'EmergencyWithdrawActivated')
            .withArgs(terra_usd.address, DEPOSIT_AMOUNT);
        });

        it('should fail for emergencyWithdraw calls not made by controller', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);
            await expect(anchor_account.connect(user).emergencyWithdraw(terra_usd.address))
            .to.reverted;
        });
    });
})