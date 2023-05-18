const { getNamedAccounts, ethers, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

const {
  isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery unit tests", async function () {
      let lottery, vrfCoordinatorV2Mock, chainId, interval;
      chainId = network.config.chainId;

      beforeEach(async function () {
        accounts = await ethers.getSigners(); // could also do with getNamedAccounts
        //account[0] = deployer
        player = accounts[0];
        await deployments.fixture(["mocks", "lottery"]);
        lottery = await ethers.getContract("Lottery", accounts[0]);
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          accounts[0]
        );
        lotteryEntranceFee = await lottery.getEntranceFee();
        interval = await lottery.getInterval();
      });
      describe("contructor", async function () {
        it("initializes the lottery correctly", async function () {
          const lotteryState = await lottery.getLotteryState(); //returns a big number- 0 if open and 1 if calculating
          const interval = await lottery.getInterval();
          assert.equal(lotteryState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });
      describe("enter lottery", async function () {
        it("reverts when you dont pay enough", async function () {
          await expect(lottery.enterLottery()).to.be.revertedWith(
            "Lottery__NotEnoughEthEntered"
          );
        });
        it("records players when they enter", async function () {
          await lottery.enterLottery({ value: lotteryEntranceFee }); //here the deployer itself is entering the lottery

          const playerFromContract = await lottery.getPlayer(0);
          assert.equal(playerFromContract, accounts[0].address);
        });
        it("emits event on enter", async function () {
          //check out chai matchers emitting events
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.emit(lottery, "LotteryEnter");
        });
        it("doesnt allow entrance when lottery is calculating", async function () {
          //in special testing and debugging session in hardhat docs, we can increase the time on the blockchain
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: "evm_mine", params: [] });
          // we now pretend to be a chainlink keeper
          await lottery.performUpkeep([]); //now the contract is in a calculating state
          await expect(
            lottery.enterLottery({ value: lotteryEntranceFee })
          ).to.be.revertedWith("Lottery__NotOpen");
        });
        describe("checkupkeep", async function () {
          it("returns false if people havent send any eth", async function () {
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]); //simulate a transaction and getting only the upkeepNeeded value
            //It calls checkUpkeep using callStatic to simulate a read-only call to the contract and retrieves the value of upkeepNeeded.
            assert(!upkeepNeeded);
          });
          it("returns false if raffle isnt open", async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            //now make it in calculating state
            await lottery.provider.send("evm_increaseTime", [
              //It advances the EVM time by interval.toNumber() + 1 seconds using evm_increaseTime to simulate the passage of time.
              interval.toNumber() + 1,
            ]);
            await lottery.provider.send("evm_mine", []); //It mines a new block using evm_mine to finalize the change in time.
            await lottery.performUpkeep([]); //It calls performUpkeep to update the state of the lottery contract based on the current time.
            const lotteryState = await lottery.getLotteryState(); //calculating
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]); //this should return false since the fucntin is calculating
            assert.equal(lotteryState.toString(), "1"); // calculating
            assert.equal(upkeepNeeded, false);
          });
          it("returns false if enough time hasnt passed", async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() - 5,
            ]); //enough time has not been passed
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
            // assert(!upkeepNeeded); // cause not enough time has passed
            assert.equal(upkeepNeeded, false);
          });
          it("returns true if enough time has passed, has players, eth, and is open", async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee }); // a player has entered with sufficient eth
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
            assert.equal(upkeepNeeded, true);
          });
        });
        describe("performUpkeep", async function () {
          it("it can only run if checkupkeep is true", async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
            const tx = await lottery.performUpkeep([]); //we made all these things so that checkupkeep returns true
            assert(tx); //this will only return true if chekcupkeep returns true
          });
          it("should revert if checkupkeep returns false", async function () {
            await expect(lottery.performUpkeep([])).to.be.revertedWith(
              "Lottery__UpKeepNotNeeded"
            );
          });
          it("updates the lottery state, emits events, and calls the vrf coordinator", async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee });
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
            const txResponse = await lottery.performUpkeep([]);
            const txReceipt = await txResponse.wait(1);
            const requestId = txReceipt.events[1].args.requestId; //we take the second event since the first event is emmited by the requestRandomWords function of the mock vrf
            const lotterState = await lottery.getLotteryState();
            assert(requestId.toNumber() > 0);
            assert(lotterState.toNumber() == 1);
          });
        });
        describe("fulfillRandomWords", function () {
          beforeEach(async function () {
            await lottery.enterLottery({ value: lotteryEntranceFee }); // we need someone to be in the lottery before each
            await network.provider.send("evm_increaseTime", [
              interval.toNumber() + 1,
            ]);
            await network.provider.send("evm_mine", []);
          });
          it("can only be called after performUpkeep", async function () {
            await expect(
              vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
            ).to.be.revertedWith("nonexistent request"); //check out the mock contract, because requst id doesnt exist
          });
          it("picks the winner, resets the lottery, and sends money", async function () {
            const additionalEntrants = 3;
            const startingAccountIndex = 1; //deployer = 0;
            for (
              let i = startingAccountIndex;
              i < startingAccountIndex + additionalEntrants;
              i++
            ) {
              const accountConnectedLottery = lottery.connect(accounts[i]);
              await accountConnectedLottery.enterLottery({
                value: lotteryEntranceFee,
              });
            }
            const startingTimeStamp = await lottery.getLatestTimeStamp();
            // performUpkeep (mock being chainlink keeper)
            //fulfillRandomWords ( mock being the chainlink vrf)
            //we will have to wait for the fulfillrandomwords to be called
            await new Promise(async (resolve, reject) => {
              lottery.once("WinnerPicked", async () => {
                //here we are setting up the listener.
                //listener function, executes when the event is emitted
                console.log("Found the event!");
                try {
                  const recentWinner = await lottery.getRecentWinner();
                  const lotteryState = await lottery.getLotteryState();
                  const endingTimeStamp = await lottery.getLatestTimeStamp();
                  const numPlayers = await lottery.getNumberOfPlayers();
                  assert.equal(numPlayers.toString(), "0");
                  assert.equal(lotteryState.toString(), "0");
                  assert(endingTimeStamp > startingTimeStamp);
                } catch (e) {
                  reject(e);
                }
                resolve();
              });

              // below, we will fire the event, and the listener will pick it up, and resolve.
              console.log("hi");
              const tx = await lottery.performUpkeep([]);
              const txReceipt = await tx.wait(1);
              await vrfCoordinatorV2Mock.fulfillRandomWords(
                txReceipt.events[1].args.requestId,
                lottery.address
              );
            });
          });
        });
      });
    });
