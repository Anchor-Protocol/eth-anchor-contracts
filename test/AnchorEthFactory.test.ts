import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { solidity } from 'ethereum-waffle';
import { Contract, ContractFactory, BigNumber, utils, Signer } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

chai.use(solidity);

describe('AnchorEthFactory', () => {
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
    let AnchorEthFactory: ContractFactory;
    let AnchorAccount: ContractFactory;

    before('initialize ContractFactory', async () => {
        TerraUSD = await ethers.getContractFactory('TerraUSD');
        AnchorUST = await ethers.getContractFactory('AnchorUST');
        AnchorEthFactory = await ethers.getContractFactory('AnchorEthFactory');
        AnchorAccount = await ethers.getContractFactory('AnchorAccount');
    });

    let terra_usd: Contract;
    let anchor_ust: Contract;
    let anchor_eth_factory: Contract;
    let anchor_account: Contract;

    beforeEach('deploy all contracts', async () => {
        terra_usd = await TerraUSD.connect(deployer).deploy();
        anchor_ust = await AnchorUST.connect(deployer).deploy();
        anchor_eth_factory = await AnchorEthFactory.connect(deployer).deploy(
            terra_usd.address,
            anchor_ust.address
        );
        anchor_account = await AnchorAccount.connect(deployer).deploy(
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
    });

    describe('#deposit', () => {
        it('should fail for finish functions when init is not called yet', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(deployer).finishDepositStable())
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

        it('should fail for finish functions when there is not enough balance', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
            ]);
            await expect(anchor_account.connect(deployer).finishDepositStable())
            .to.revertedWith('AnchorAccount: finish deposit operation: not enough aust');
        });

        it('should work for finish functions', async () => {
            await Promise.all([
                terra_usd.connect(deployer).mint(user.address, DEPOSIT_AMOUNT),
                terra_usd.connect(user).approve(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initDepositStable(DEPOSIT_AMOUNT),
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(deployer).finishDepositStable())
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

        it('should work for initializer functions', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
            ]);

            await expect(anchor_account.connect(user).initRedeemStable())
            .to.emit(anchor_account, 'InitRedemption')
            .withArgs(
                user.address,
                DEPOSIT_AMOUNT, 
                '0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'
            );
        });

        it('should fail for initializer functions when finish is not called yet', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initRedeemStable(),
            ]);

            await expect(anchor_account.connect(user).initRedeemStable())
            .to.revertedWith('AnchorAccount: init operation: init already called');
        });

        it('should fail for finish functions when there is not enough balance', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initRedeemStable(),
            ]);

            await expect(anchor_account.connect(deployer).finishRedeemStable())
            .to.revertedWith('AnchorAccount: finish redemption operation: not enough ust');
        });

        it('should work for finish functions', async () => {
            await Promise.all([
                anchor_ust.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
                anchor_account.connect(deployer).setTerraAddress('0x890d71d9e7031a9a09b82c214dba08a413e133a5000000000000000000000000'),
                anchor_account.connect(user).initRedeemStable(),
                terra_usd.connect(deployer).mint(anchor_account.address, DEPOSIT_AMOUNT),
            ]);

            await expect(anchor_account.connect(deployer).finishRedeemStable())
            .to.emit(anchor_account, 'FinishRedemption')
            .withArgs(user.address);
        });
    });
})