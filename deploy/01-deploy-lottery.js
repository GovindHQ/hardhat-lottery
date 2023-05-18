/**
 getSigners and getNamedAccounts are both used for the same purpose, getting public key for accounts.

Since you asked for getNamedAccounts I assume you are developing on a hardhat environment
 because it is used to retrieve accounts manually from the attribute namedAccounts defined
  whithin hardhat.config.js and it is an exclusive feature with the plugin hardhat-deploy.

In the other hand a signer in ethers.js is an object that represents an Ethereum account.
 getSigners helps getting a list of the accounts in the node we're connected to, which is probably 
 the Hardhat Network.
*/
require("dotenv").config();
const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseUnits("2");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;
  const chainId = network.config.chainId;
  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callBackGasLimit = networkConfig[chainId]["callBackGasLimit"];
  const interval = networkConfig[chainId]["interval"];

  if (developmentChains.includes(network.name)) {
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1); //an event with the subcription id is emitted here, check the mock contract.
    subscriptionId = transactionReceipt.events[0].args.subId;
    //fund the mock
    await vrfCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMOUNT
    );
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }
  const arguments = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callBackGasLimit,
    interval,
  ];
  const lottery = await deploy("Lottery", {
    from: deployer,
    args: arguments,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
  }

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("verifying....");
    await verify(lottery.address, arguments);
  }
  log("------------------------------");
};

module.exports.tags = ["all", "lottery"];
