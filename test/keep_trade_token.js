const { BN } = require("@openzeppelin/test-helpers");
const { fromWei } = web3.utils;

const KeepTradeToken = artifacts.require("KeepTrade");

contract("KeepTrade", async (accounts) => {
	const admin = accounts[0];

	it("has a name", async function () {
		const token = await KeepTradeToken.deployed();
		assert.equal(await token.name(), "KeepTrade");
	});

	it("has a symbol", async function () {
		const token = await KeepTradeToken.deployed();
		assert.equal(await token.symbol(), "KPTR");
	});

	it("assigns the initial total supply to the creator", async function () {
		const token = await KeepTradeToken.deployed();
		const totalSupply = await token.totalSupply();
		const creatorBalance = await token.balanceOf(admin);

		assert.equal(fromWei(creatorBalance), fromWei(totalSupply));
	});

	it("should send coin correctly", async function () {
		const token = await KeepTradeToken.deployed();

		// Setup 2 accounts.
		const sender = admin;
		const receiver = accounts[1];

		// Get initial balances of first and second account.
		const accountOneStartingBalance = await token.balanceOf.call(sender);
		const accountTwoStartingBalance = await token.balanceOf.call(receiver);

		// Make transaction from first account to second.
		const amount = new BN("15000000000000000000");
		await token.transfer(receiver, amount, { from: sender });

		// Get balances of first and second account after the transactions.
		const accountOneEndingBalance = await token.balanceOf.call(sender);
		const accountTwoEndingBalance = await token.balanceOf.call(receiver);

		assert.equal(fromWei(accountOneEndingBalance), fromWei(accountOneStartingBalance.sub(amount)), "Amount wasn't correctly taken from the sender");
		assert.equal(fromWei(accountTwoEndingBalance), fromWei(accountTwoStartingBalance.add(amount)), "Amount wasn't correctly sent to the receiver");
	});

	it("should burn coin correctly", async function () {
		const token = await KeepTradeToken.deployed();
		const startingBalance = await token.balanceOf.call(admin);
		const startingTotalSupply = await token.totalSupply.call();
		const amount = new BN("20000000000000000000");

		await token.burn(amount, { from: admin });

		const endingBalance = await token.balanceOf.call(admin);
		const endingTotalSupply = await token.totalSupply.call();

		assert.equal(fromWei(endingBalance), fromWei(startingBalance.sub(amount)), "Amount wasn't correctly taken from the sender");
		assert.equal(fromWei(endingTotalSupply), fromWei(startingTotalSupply.sub(amount)), "Amount wasn't correctly taken from the sender");
	});
});
