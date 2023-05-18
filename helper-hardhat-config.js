const { ethers } = require("hardhat");

const networkConfig = {
  31337: {
    name: "localhost",
    entranceFee: ethers.utils.parseEther("0.1"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", //doent matter what gasLane we use on the local network
    subscriptionId: "0",
    callBackGasLimit: "500000",
    interval: "30",
  },
  11155111: {
    name: "sepolia",
    vrfCoordinatorV2: "0x8103b0a8a00be2ddc778e6e7eaa21791cd364625",
    entranceFee: ethers.utils.parseEther("0.1"),
    gasLane:
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    callBackGasLimit: "500000",
    subscriptionId: "2022",
    interval: "30",
  },
};

const developmentChains = ["hardhat", "localhost"];
module.exports = { networkConfig, developmentChains };
