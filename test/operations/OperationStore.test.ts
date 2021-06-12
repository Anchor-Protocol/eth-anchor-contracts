import chai, { expect } from "chai";
import { ethers } from "hardhat";
import { solidity } from "ethereum-waffle";
import {
  Contract,
  ContractFactory,
  BigNumber,
  utils,
  BigNumberish,
} from "ethers";
import { isCommunityResourcable, Provider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import {
  advanceTimeAndBlock,
  encodeParameters,
  filterStructFields,
  latestBlocktime,
} from "../shared/utilities";
import { Queue, Status } from "../utils/TypeOperationStore";

chai.use(solidity);

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
const TEST_ADDR = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";

describe("OperationStore", () => {
  const { provider } = ethers;

  let owner: SignerWithAddress;
  let operator: SignerWithAddress;

  before("setup", async () => {
    [owner, operator] = await ethers.getSigners();
  });

  let store: Contract;

  beforeEach("deploy contract", async () => {
    const OperationStore = await ethers.getContractFactory("OperationStore");
    store = await OperationStore.connect(owner).deploy();
    await store.connect(owner).transferRouter(operator.address);
    await store.connect(owner).transferController(operator.address);
  });

  describe("lifecycle", () => {
    beforeEach("alloc", async () => {
      await expect(store.connect(owner).allocate(TEST_ADDR))
        .to.emit(store, "OperationAllocated")
        .withArgs(owner.address, TEST_ADDR);
      expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.IDLE);
      expect(await store.getAvailableOperation()).to.eq(TEST_ADDR);
    });

    describe("init", () => {
      describe("=> finish", () => {
        it("#autoFinish = true", async () => {
          await expect(store.connect(operator).init(true))
            .to.emit(store, "OperationInitialized")
            .withArgs(operator.address, TEST_ADDR, true);
          expect(await store.getAvailableOperation()).to.eq(ZERO_ADDR);
          expect(await store.getQueuedOperationAt(Queue.RUNNING, 0)).to.eq(
            TEST_ADDR
          );
          expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.RUNNING_AUTO);

          await expect(store.connect(operator).finish(TEST_ADDR))
            .to.emit(store, "OperationFinished")
            .withArgs(operator.address, TEST_ADDR);
          expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.FINISHED);

          await expect(store.connect(operator).flush(Queue.RUNNING, 10))
            .to.emit(store, "OperationFlushed")
            .withArgs(operator.address, TEST_ADDR, Queue.RUNNING, Queue.IDLE);

          expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.IDLE);
          expect(await store.getAvailableOperation()).to.eq(TEST_ADDR);
          expect(await store.getQueuedOperationAt(Queue.RUNNING, 0)).to.eq(
            ZERO_ADDR
          );
        });

        it("#autoFinish = false", async () => {
          await expect(store.connect(operator).init(false))
            .to.emit(store, "OperationInitialized")
            .withArgs(operator.address, TEST_ADDR, false);
          expect(await store.getAvailableOperation()).to.eq(ZERO_ADDR);
          expect(await store.getQueuedOperationAt(Queue.RUNNING, 0)).to.eq(
            ZERO_ADDR
          );
          expect(await store.getStatusOf(TEST_ADDR)).to.eq(
            Status.RUNNING_MANUAL
          );

          await expect(store.connect(operator).finish(TEST_ADDR))
            .to.emit(store, "OperationFinished")
            .withArgs(operator.address, TEST_ADDR)
            .to.emit(store, "OperationAllocated")
            .withArgs(operator.address, TEST_ADDR);

          expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.IDLE);
          expect(await store.getAvailableOperation()).to.eq(TEST_ADDR);
          expect(await store.getQueuedOperationAt(Queue.RUNNING, 0)).to.eq(
            ZERO_ADDR
          );
        });
      });

      describe("=> fail", () => {
        it("#idle", async () => {
          await expect(store.connect(operator).halt(TEST_ADDR))
            .to.emit(store, "OperationStopped")
            .withArgs(operator.address, TEST_ADDR);
          expect(await store.getAvailableOperation()).to.eq(ZERO_ADDR);
          expect(await store.getQueuedOperationAt(Queue.STOPPED, 0)).to.eq(
            TEST_ADDR
          );
        });

        it("#running", async () => {
          await store.connect(operator).init(true);
          await expect(store.connect(operator).halt(TEST_ADDR))
            .to.emit(store, "OperationStopped")
            .withArgs(operator.address, TEST_ADDR);
          expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.STOPPED);

          await expect(store.connect(operator).flush(Queue.RUNNING, 10))
            .to.emit(store, "OperationFlushed")
            .withArgs(
              operator.address,
              TEST_ADDR,
              Queue.RUNNING,
              Queue.STOPPED
            );

          expect(await store.getQueuedOperationAt(Queue.RUNNING, 0)).to.eq(
            ZERO_ADDR
          );
          expect(await store.getQueuedOperationAt(Queue.STOPPED, 0)).to.eq(
            TEST_ADDR
          );
        });

        describe("#queue", () => {
          beforeEach("setup", async () => {
            await store.connect(operator).init(true);
            await store.connect(operator).halt(TEST_ADDR);
            await store.connect(operator).flush(Queue.RUNNING, 10);
          });

          it("=> recover", async () => {
            await expect(store.connect(operator).recover(TEST_ADDR))
              .to.emit(store, "OperationRecovered")
              .withArgs(operator.address, TEST_ADDR);
            expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.RECOVERED);

            await expect(store.connect(operator).flush(Queue.STOPPED, 10))
              .to.emit(store, "OperationFlushed")
              .withArgs(operator.address, TEST_ADDR, Queue.STOPPED, Queue.IDLE);

            expect(await store.getStatusOf(TEST_ADDR)).to.eq(Status.IDLE);
            expect(await store.getQueuedOperationAt(Queue.STOPPED, 0)).to.eq(
              ZERO_ADDR
            );
            expect(await store.getAvailableOperation()).to.eq(TEST_ADDR);
          });

          it("=> dealloc", async () => {
            await expect(store.connect(operator).deallocate(TEST_ADDR))
              .to.emit(store, "OperationDeallocated")
              .withArgs(operator.address, TEST_ADDR);
            expect(await store.getStatusOf(TEST_ADDR)).to.eq(
              Status.DEALLOCATED
            );

            await expect(store.connect(operator).flush(Queue.STOPPED, 10))
              .to.emit(store, "OperationFlushed")
              .withArgs(operator.address, TEST_ADDR, Queue.STOPPED, Queue.NULL);

            expect(await store.getStatusOf(TEST_ADDR)).to.eq(
              Status.DEALLOCATED
            );
            expect(await store.getQueuedOperationAt(Queue.STOPPED, 0)).to.eq(
              ZERO_ADDR
            );
            expect(await store.getAvailableOperation()).to.eq(ZERO_ADDR);
          });
        });
      });
    });
  });
});
