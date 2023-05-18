const { developmentChains } = require("../helper-hardhat-config");
const { network } = require("hardhat");

const GAS_PRICE_LINK = 1e9; //1000000000 //calculted value based on the gas price of the chain.
const BASE_FEE = ethers.utils.parseEther("0.25"); //0.25 is the base link you have to spend(premium) check docs,
//this is passed as arguments to the mock contract.

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const { chainId } = network.config.chainId;
  const args = [BASE_FEE, GAS_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");
    //deploy a mock vrfCoordinator...
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: args,
      log: true,
    });
    log("Mocks deployed!");
    log("--------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
