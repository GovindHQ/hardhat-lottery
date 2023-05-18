const { getNamedAccounts, ethers, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");

const {
  isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Lottery staging tests", function () {
      let lottery, vrfCoordinatorV2Mock;

      beforeEach(async function () {
        // could also do with getNamedAccounts
        //account[0] = deployer
        const { deployer } = await getNamedAccounts();
        lottery = await ethers.getContract("Lottery", deployer);
        lotteryEntranceFee = await lottery.getEntranceFee();
      });

      describe("fulfillRandonWords", function () {
        it("works with live chainlink keepers and chainlink vrf, and we get a random winner", async function () {
          //enter the lottery
          console.log("Setting up the test...");
          const startingTimeStamp = await lottery.getLatestTimeStamp();
          accounts = await ethers.getSigners();
          //setting up listener before we enter the raffle
          console.log("Setting up the listener");
          await new Promise(async (resolve, reject) => {
            lottery.once("WinnerPicked", async function () {
              console.log("wWinnerpicked event fired!");
              try {
                const recentWinner = await lottery.getRecentWinner();
                const lotteryState = await lottery.getLotteryState();
                const winnerBalance = await accounts[0].getBalance();
                const endingTimeStamp = await lottery.getLatestTimeStamp();
                await expect(lottery.getPlayer(0)).to.be.reverted;
                assert.equal(recentWinner.toString(), accounts[0].address);
                assert.equal(lotteryState, 0);
                assert.equal(
                  winnerBalance.toString(),
                  winnerStartingBalance.add(lotteryEntranceFee).toString()
                );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
          });
          //entering the raffle
          console.log("Entering the lottery");
          const tx = await lottery.enterLottery({ value: lotteryEntranceFee });
          await tx.wait(1);
          console.log("Ok, time to wait!....");
          const winnerStartingBalance = await accounts[0].getBalance();
          //this code wont complete until our listener has finished listening
        });
      });
    });
