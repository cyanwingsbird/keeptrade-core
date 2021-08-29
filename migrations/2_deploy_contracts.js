const KeepTrade = artifacts.require("KeepTrade");
const KeepTradeV1Core = artifacts.require("KeepTradeV1Core");
require("@openzeppelin/test-helpers/configure")({
  provider: web3.currentProvider,
  environment: "truffle",
});
const { singletons } = require("@openzeppelin/test-helpers");

module.exports = async function (deployer, network, accounts) {
  if (network === "development") {
    // In a test environment an ERC777 token requires deploying an ERC1820 registry
    await singletons.ERC1820Registry(accounts[0]);
  }
  await deployer.deploy(KeepTrade, "100000000000000000000000000");
  await deployer.deploy(KeepTradeV1Core, KeepTrade.address, 100 , 30 , 0 , 20 , 0, 10000, 0, "100000000000000000000000", "500000000000000000000000", "10000000000000000000000");
};
