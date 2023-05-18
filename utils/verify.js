const verify = async (contractAddress, args) => {
  //function to verify contract automatically on etherscan
  //check out hardhat doc for verifying contracts plugins
  console.log("verifying contract...");
  //we can run any task from hardhat using run package
  try {
    //if the await throws an error
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified!");
    } else {
      console.log(e);
    }
  }
};

module.exports = { verify };
module.exports.tags = ["all", "verify"];
