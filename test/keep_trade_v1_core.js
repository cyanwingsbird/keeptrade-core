const { BN } = require("@openzeppelin/test-helpers");
const { fromWei, toWei } = web3.utils;
const truffleAssert = require('truffle-assertions');

const KeepTradeCore = artifacts.require("KeepTradeV1Core");
const KeepTradeToken = artifacts.require("KeepTrade");

const ERC20PresetMinterPauser = artifacts.require('@openzeppelin/contracts/ERC20PresetMinterPauser');

async function keeperGetAmountIn(keepTrade, amountOut, keeperKPTR, traderKPTR, rate) {
	const keeperL2Requirement = await keepTrade.keeperL2Requirement();
	const keeperL3Requirement = await keepTrade.keeperL3Requirement();
	const tradeDiscountRequirement = await keepTrade.tradeDiscountRequirement();
	const feeBase = await keepTrade.feeBase();
	let base = new BN("1000000000000000000");

	if(keeperKPTR < keeperL2Requirement) {
		const keeperL1FeeMul = await keepTrade.keeperL1FeeMul();
		base = base.sub(base.mul(keeperL1FeeMul).div(feeBase));
	} else if (keeperKPTR < keeperL3Requirement) {
		const keeperL2FeeMul = await keepTrade.keeperL2FeeMul();
		base = base.sub(base.mul(keeperL2FeeMul).div(feeBase));
	} else {
		const keeperL3FeeMul = await keepTrade.keeperL3FeeMul();
		base = base.sub(base.mul(keeperL3FeeMul).div(feeBase));
	}

	if (traderKPTR < tradeDiscountRequirement) {
		const tradeBasicFeeMul = await keepTrade.tradeBasicFeeMul();
		base = base.sub(base.mul(tradeBasicFeeMul).div(feeBase));
	} else {
		const tradeDiscountFeeMul = await keepTrade.tradeDiscountFeeMul();
		base = base.sub(base.mul(tradeDiscountFeeMul).div(feeBase));
	}
	return amountOut.mul(rate).div(base);
}

async function keeperGetAmountEth(keepTrade, amount, keeperKPTR, traderKPTR) {
	const keeperL2Requirement = await keepTrade.keeperL2Requirement();
	const keeperL3Requirement = await keepTrade.keeperL3Requirement();
	const tradeDiscountRequirement = await keepTrade.tradeDiscountRequirement();
	const feeBase = await keepTrade.feeBase();
	let base = new BN("1000000000000000000");

	if(keeperKPTR < keeperL2Requirement) {
		const keeperL1FeeMul = await keepTrade.keeperL1FeeMul();
		base = base.sub(base.mul(keeperL1FeeMul).div(feeBase));
	} else if (keeperKPTR < keeperL3Requirement) {
		const keeperL2FeeMul = await keepTrade.keeperL2FeeMul();
		base = base.sub(base.mul(keeperL2FeeMul).div(feeBase));
	} else {
		const keeperL3FeeMul = await keepTrade.keeperL3FeeMul();
		base = base.sub(base.mul(keeperL3FeeMul).div(feeBase));
	}

	if (traderKPTR < tradeDiscountRequirement) {
		const tradeBasicFeeMul = await keepTrade.tradeBasicFeeMul();
		base = base.sub(base.mul(tradeBasicFeeMul).div(feeBase));
	} else {
		const tradeDiscountFeeMul = await keepTrade.tradeDiscountFeeMul();
		base = base.sub(base.mul(tradeDiscountFeeMul).div(feeBase));
	}
	return amount.mul(base).div(new BN("1000000000000000000"));
}

function traderGetAmountOut(amountIn, rate) {
	const base = new BN("1000000000000000000");
	return amountIn.mul(rate).div(base);
}

contract("KeepTradeV1Core", async (accounts) => {
	let keepTradeToken;
	let keepTrade;
	let tokenA;
	let tokenB;
	const TradeType = {
		EthToToken: 0,
		TokenToToken: 1,
		TokenToEth: 2
	}

	before(async () => {
		keepTradeToken = await KeepTradeToken.deployed();
		keepTrade = await KeepTradeCore.deployed();
		const mintAmount = new BN("10000000000000000000000"); //10000
		tokenA = await ERC20PresetMinterPauser.new("Token A", "TA", {from: accounts[1]});
		await tokenA.mint(accounts[1], mintAmount, {from: accounts[1]})
		tokenB = await ERC20PresetMinterPauser.new("Token B", "TB", {from: accounts[2]});
		await tokenB.mint(accounts[2], mintAmount, {from: accounts[2]})
	});

	describe('set requirements', () => {
		it("should only can change by owner", async function () {
			await truffleAssert.reverts(
				keepTrade.setRequirements(toWei("10"), toWei("2000"), toWei("20000"), toWei("100"), {from: accounts[1]}),
				"Ownable: caller is not the owner."
			);
		});

		it("should change requirements correctly", async function () {
			await keepTrade.setRequirements(toWei("10"), toWei("2000"), toWei("20000"), toWei("100"));
			assert.equal(fromWei(await keepTrade.keeperL1Requirement()), "10");
			assert.equal(fromWei(await keepTrade.keeperL2Requirement()), "2000");
			assert.equal(fromWei(await keepTrade.keeperL3Requirement()), "20000");
			assert.equal(fromWei(await keepTrade.tradeDiscountRequirement()), "100");
		});

		it("should throw error if requirements is not in order", async function () {
			await truffleAssert.reverts(
				keepTrade.setRequirements(toWei("10"), toWei("0"), toWei("20000"), toWei("100")),
				"Requirement levels should be in order."
			);
		});

		after(async () => {
			await keepTrade.setRequirements(toWei("0"), toWei("1000"), toWei("10000"), toWei("50"));
			assert.equal(fromWei(await keepTrade.keeperL1Requirement()), "0");
			assert.equal(fromWei(await keepTrade.keeperL2Requirement()), "1000");
			assert.equal(fromWei(await keepTrade.keeperL3Requirement()), "10000");
			assert.equal(fromWei(await keepTrade.tradeDiscountRequirement()), "50");
		});
	});

	describe('set fees', () => {
		it("should only can change by owner", async function () {
			await truffleAssert.reverts(
				keepTrade.setFees("200", "100", "0", "20", "0", "10000", {from: accounts[1]}),
				"Ownable: caller is not the owner."
			);
		});

		it("should change fees correctly", async function () {
			await keepTrade.setFees("200", "100", "10", "20", "10", "10000");
			assert.equal((await keepTrade.keeperL1FeeMul()).toString(), "200");
			assert.equal((await keepTrade.keeperL2FeeMul()).toString(), "100");
			assert.equal((await keepTrade.keeperL3FeeMul()).toString(), "10");
			assert.equal((await keepTrade.tradeBasicFeeMul()).toString(), "20");
			assert.equal((await keepTrade.tradeDiscountFeeMul()).toString(), "10");
			assert.equal((await keepTrade.feeBase()).toString(), "10000");
		});

		it("should throw error if Keeper fees are not in order", async function () {
			await truffleAssert.reverts(
				keepTrade.setFees("200", "300", "0", "20", "0", "10000"),
				"Keeper fees should be in order."
			);
		});

		it("should throw error if trader fees is not in order", async function () {
			await truffleAssert.reverts(
				keepTrade.setFees("200", "100", "0", "20", "30", "10000"),
				"Trade fees should be in order."
			);
		});

		it("should throw error if fees base is too small", async function () {
			await truffleAssert.reverts(
				keepTrade.setFees("200", "100", "0", "20", "0", "20"),
				"Fee Base input error."
			);
		});

		after(async () => {
			await keepTrade.setFees("100", "50", "0", "10", "0", "10000");
			assert.equal((await keepTrade.keeperL1FeeMul()).toString(), "100");
			assert.equal((await keepTrade.keeperL2FeeMul()).toString(), "50");
			assert.equal((await keepTrade.keeperL3FeeMul()).toString(), "0");
			assert.equal((await keepTrade.tradeBasicFeeMul()).toString(), "10");
			assert.equal((await keepTrade.tradeDiscountFeeMul()).toString(), "0");
			assert.equal((await keepTrade.feeBase()).toString(), "10000");
		});
	});


	describe('set governance', () => {
		it("have a governance", async function () {
			assert.equal(await keepTrade.governance(), accounts[0]);
		});

		it("should only can change by owner", async function () {
			await truffleAssert.reverts(
				keepTrade.setGovernance(accounts[1], {from: accounts[1]}),
				"Ownable: caller is not the owner."
			);
		});

		it("should change governance correctly", async function () {
			await keepTrade.setGovernance(accounts[1]);
			assert.equal(await keepTrade.governance(), accounts[1]);
		});

		after(async () => {
			await keepTrade.setGovernance(accounts[0]);
			assert.equal(await keepTrade.governance(), accounts[0]);
		});
	});

	describe('tradeTokensForTokens', () => {
		const governance = accounts[0];
		const trader = accounts[1];
		const keeper = accounts[2];
		let traderTokenABeforeBalance;
		let traderTokenBBeforeBalance;
		let keeperTokenABeforeBalance;
		let keeperTokenBBeforeBalance;
		let governanceTokenBeforeBalance;
		let traderKPTRBalance;
		let keeperKPTRBalance;
		let beforeTradeId;
		let beforeCurrentTradeCount;
		let beforeAddressTradeCount;
		beforeEach(async () => {
			governanceTokenBeforeBalance = await tokenB.balanceOf(governance);
			traderTokenABeforeBalance = await tokenA.balanceOf(trader);
			traderTokenBBeforeBalance = await tokenB.balanceOf(trader);
			keeperTokenABeforeBalance = await tokenA.balanceOf(keeper);
			keeperTokenBBeforeBalance = await tokenB.balanceOf(keeper);
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
			beforeTradeId = (await keepTrade.tradeIndex()).toNumber();
			beforeCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			beforeAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
		});

		it("should trade correctly when fill at once", async function () {
			const amount = new BN("1000000000000000000"); //1
			const rate = new BN("50000000000000000"); //0.05

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const allowance = await tokenA.allowance(trader, keepTrade.address, { from: trader });
			assert.equal(fromWei(allowance), fromWei(amount), "Token A approve failed");

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			//console.log("Gas used for tradeTokensForTokens: ", tradeInfo.receipt.gasUsed);

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			assert.equal(tradeId, beforeTradeId, "Trade Id should equal to previous trade index");

			const afterTradeId = (await keepTrade.tradeIndex()).toNumber();
			assert.equal(afterTradeId, beforeTradeId + 1, "Trade Id should increased by 1");

			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.TokenToToken, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.fromToken, tokenA.address, "Trade from token incorrect");
			assert.equal(trade.toToken, tokenB.address, "Trade to token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const fillAmount = await keeperGetAmountIn(keepTrade, amount, keeperKPTRBalance, traderKPTRBalance, rate);

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });
			const allowanceTokenB = await tokenB.allowance(keeper, keepTrade.address, { from: keeper });
			assert.equal(fromWei(allowanceTokenB), fromWei(fillAmount), "Token B approve failed");

			const fillTradeInfo = await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount, { from: keeper });
			//console.log("Gas used for fillTradeTokensForTokens: ", fillTradeInfo.receipt.gasUsed);

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceTokenAfterBalance = await tokenB.balanceOf(await keepTrade.governance());
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(amount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceTokenAfterBalance), fromWei(governanceTokenBeforeBalance.add(fillAmount.sub(traderGetAmountOut(amount, rate)))), "Amount wasn't correctly added to the governance");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when refund required", async function () {
			const amount = new BN("1100");
			const rate = new BN("7000000000000000"); //0.007

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.TokenToToken, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.fromToken, tokenA.address, "Trade from token incorrect");
			assert.equal(trade.toToken, tokenB.address, "Trade to token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const fillAmount = await keeperGetAmountIn(keepTrade, amount, keeperKPTRBalance, traderKPTRBalance, rate);

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });
			const allowanceTokenB = await tokenB.allowance(keeper, keepTrade.address, { from: keeper });
			assert.equal(fromWei(allowanceTokenB), fromWei(fillAmount), "Token B approve failed");

			await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount, { from: keeper });

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceTokenAfterBalance = await tokenB.balanceOf(await keepTrade.governance());
			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(new BN("1000"))), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceTokenAfterBalance), fromWei(governanceTokenBeforeBalance.add(fillAmount.sub(traderGetAmountOut(amount, rate)))), "Amount wasn't correctly added to the governance");
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(new BN("100"))), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should cancel correctly and refund", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenABeforeBalance), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const fillAmount = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, rate);

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });

			await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount, { from: keeper });

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceTokenAfterBalance = await tokenB.balanceOf(await keepTrade.governance());
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(singleTradeAmount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceTokenAfterBalance), fromWei(governanceTokenBeforeBalance.add(fillAmount.sub(traderGetAmountOut(singleTradeAmount, rate)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(amount.sub(singleTradeAmount))), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> change rate -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, oldRate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });
			const trade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const fillAmount = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, rate);

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });

			await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount, { from: keeper });

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceTokenAfterBalance = await tokenB.balanceOf(await keepTrade.governance());
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(singleTradeAmount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceTokenAfterBalance), fromWei(governanceTokenBeforeBalance.add(fillAmount.sub(traderGetAmountOut(singleTradeAmount, rate)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(amount.sub(singleTradeAmount))), "Amount wasn't correctly refunded to the trader");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when modify requirement / fees / rate / fill at any time", async function () {
			const amount = new BN("2000000000000000010"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			//////////////
			//Set trade
			//////////////
			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, oldRate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("4"));
			const fillAmount1 = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, oldRate);
			await tokenB.approve(keepTrade.address, fillAmount1, { from: keeper });
			await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount1, { from: keeper });

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });

			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("200", "100", "10", "20", "10", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(trader, (await keepTrade.tradeDiscountRequirement()).sub(traderKPTRBalance));
			await keepTradeToken.transfer(keeper, (await keepTrade.keeperL2Requirement()).sub(keeperKPTRBalance));
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);

			//////////////
			//fill
			//////////////
			const fillAmount2 = await keeperGetAmountIn(keepTrade, amount.sub(singleTradeAmount), keeperKPTRBalance, traderKPTRBalance, rate);

			await tokenB.approve(keepTrade.address, fillAmount2, { from: keeper });

			await keepTrade.fillTradeTokensForTokens(tradeId, fillAmount2, { from: keeper });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceTokenAfterBalance = await tokenB.balanceOf(await keepTrade.governance());

			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(new BN("10"))), "Amount wasn't correctly refunded to the trader");


			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, oldRate).add(traderGetAmountOut(amount.sub(singleTradeAmount), rate)))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(amount.sub(new BN("10")))), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount1.add(fillAmount2))), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceTokenAfterBalance), fromWei(governanceTokenBeforeBalance.add(fillAmount1.sub(traderGetAmountOut(singleTradeAmount, oldRate))).add(fillAmount2.sub(traderGetAmountOut(amount.sub(singleTradeAmount), rate)))), "Amount wasn't correctly added to the governance");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");

			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("100", "50", "0", "10", "0", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(governance, (await keepTrade.tradeDiscountRequirement()), {from: trader});
			await keepTradeToken.transfer(governance, (await keepTrade.keeperL2Requirement()), {from: keeper});
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
		});

		it("should throw error when fill with invalid trade ID", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForTokens(tradeId+1, "100000", { from: keeper }),
				"Invalid trade ID"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});

		it("should throw error when fill with invalid trade type", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForETH(tradeId, { from: keeper }),
				"Invalid trade type"
			);

			await truffleAssert.reverts(
				keepTrade.fillTradeETHForTokens(tradeId, "1000", { from: keeper }),
				"Invalid trade type"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});
	});

	describe('tradeETHForTokens', () => {
		const governance = accounts[0];
		const trader = accounts[1];
		const keeper = accounts[2];
		let traderTokenBBeforeBalance;
		let keeperTokenBBeforeBalance;
		let keeperEthBeforeBalance;
		let governanceEthBeforeBalance;
		let traderKPTRBalance;
		let keeperKPTRBalance;
		let beforeTradeId;
		let beforeCurrentTradeCount;
		let beforeAddressTradeCount;
		beforeEach(async () => {
			keeperEthBeforeBalance = new BN(await web3.eth.getBalance(keeper));
			governanceEthBeforeBalance = new BN(await web3.eth.getBalance(governance));
			traderTokenBBeforeBalance = await tokenB.balanceOf(trader);
			keeperTokenBBeforeBalance = await tokenB.balanceOf(keeper);
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
			beforeTradeId = (await keepTrade.tradeIndex()).toNumber();
			beforeCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			beforeAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
		});

		it("should trade correctly when fill at once", async function () {
			const amount = new BN("1000000000000000000"); //1
			const rate = new BN("50000000000000000"); //0.05

			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			assert.equal(tradeId, beforeTradeId, "Trade Id should equal to previous trade index");
			const afterTradeId = (await keepTrade.tradeIndex()).toNumber();
			assert.equal(afterTradeId, beforeTradeId + 1, "Trade Id should increased by 1");

			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.EthToToken, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.toToken, tokenB.address, "Trade to token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const fillAmount = amount.mul(rate).div(new BN("1000000000000000000"));

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });

			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount, { from: keeper });

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceEthAfterBalance = await web3.eth.getBalance(governance);
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(amount.sub(await keeperGetAmountEth(keepTrade, amount, keeperKPTRBalance, traderKPTRBalance)))), "Amount wasn't correctly added to the governance");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when refund required", async function () {
			const amount = new BN("1100");
			const rate = new BN("7000000000000000"); //0.007

			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.EthToToken, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.toToken, tokenB.address, "Trade to token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			const fillAmount = amount.mul(rate).div(new BN("1000000000000000000"));
			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });
			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount, { from: keeper });

			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(new BN("100"))), "Amount wasn't correctly added to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should cancel correctly and refund", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			//////////////
			//Cancel
			//////////////
			const traderEthBeforeRefundBalance = new BN(await web3.eth.getBalance(trader));
			await keepTrade.cancelTrades([tradeId], { from: trader });
			const traderEthAfterRefundBalance = new BN(await web3.eth.getBalance(trader));

			assert.equal(parseFloat(fromWei(traderEthAfterRefundBalance)).toFixed(1), parseFloat(fromWei(traderEthBeforeRefundBalance.add(amount))).toFixed(1), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const fillAmount = singleTradeAmount.mul(rate).div(new BN("1000000000000000000"));

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });
			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount, { from: keeper });

			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceEthAfterBalance = await web3.eth.getBalance(governance);
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(singleTradeAmount.sub(await keeperGetAmountEth(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			const traderEthBeforeRefundBalance = new BN(await web3.eth.getBalance(trader));
			await keepTrade.cancelTrades([tradeId], { from: trader });
			const traderEthAfterRefundBalance = new BN(await web3.eth.getBalance(trader));

			assert.equal(parseFloat(fromWei(traderEthAfterRefundBalance)).toFixed(1), parseFloat(fromWei(traderEthBeforeRefundBalance.add(amount).sub(singleTradeAmount))).toFixed(1), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> change rate -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, oldRate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });
			const trade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const fillAmount = singleTradeAmount.mul(rate).div(new BN("1000000000000000000"));

			await tokenB.approve(keepTrade.address, fillAmount, { from: keeper });
			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount, { from: keeper });


			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);
			const governanceEthAfterBalance = await web3.eth.getBalance(governance);
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount)), "Amount wasn't correctly taken from the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(singleTradeAmount.sub(await keeperGetAmountEth(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			const traderEthBeforeRefundBalance = new BN(await web3.eth.getBalance(trader));
			await keepTrade.cancelTrades([tradeId], { from: trader });
			const traderEthAfterRefundBalance = new BN(await web3.eth.getBalance(trader));

			assert.equal(parseFloat(fromWei(traderEthAfterRefundBalance)).toFixed(1), parseFloat(fromWei(traderEthBeforeRefundBalance.add(amount).sub(singleTradeAmount))).toFixed(1), "Amount wasn't correctly refunded to the trader");
			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when modify requirement / fees / rate / fill at any time", async function () {
			const amount = new BN("2000000000000000010"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04
			governanceEthBeforeBalance = new BN(await web3.eth.getBalance(governance));

			//////////////
			//Set trade
			//////////////
			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, oldRate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("4"));
			const fillAmount1 = singleTradeAmount.mul(oldRate).div(new BN("1000000000000000000"));
			await tokenB.approve(keepTrade.address, fillAmount1, { from: keeper });
			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount1, { from: keeper });

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });

			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("200", "100", "10", "20", "10", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(trader, (await keepTrade.tradeDiscountRequirement()).sub(traderKPTRBalance));
			await keepTradeToken.transfer(keeper, (await keepTrade.keeperL2Requirement()).sub(keeperKPTRBalance));
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);

			//////////////
			//fill
			//////////////
			const fillAmount2 = amount.sub(singleTradeAmount).mul(rate).div(new BN("1000000000000000000"));
			await tokenB.approve(keepTrade.address, fillAmount2, { from: keeper });

			const traderEthBeforeRefundBalance = new BN(await web3.eth.getBalance(trader));
			await keepTrade.fillTradeETHForTokens(tradeId, fillAmount2, { from: keeper });
			const traderEthAfterRefundBalance = new BN(await web3.eth.getBalance(trader));



			const traderTokenBAfterBalance = await tokenB.balanceOf(trader);
			const keeperTokenBAfterBalance = await tokenB.balanceOf(keeper);

			assert.equal(fromWei(traderEthAfterRefundBalance), fromWei(traderEthBeforeRefundBalance.add(new BN("10"))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(traderTokenBAfterBalance), fromWei(traderTokenBBeforeBalance.add(traderGetAmountOut(singleTradeAmount, oldRate).add(traderGetAmountOut(amount.sub(singleTradeAmount), rate)))), "Amount wasn't correctly added to the trader");

			assert.equal(fromWei(keeperTokenBAfterBalance), fromWei(keeperTokenBBeforeBalance.sub(fillAmount1.add(fillAmount2))), "Amount wasn't correctly taken from the keeper");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");


			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("100", "50", "0", "10", "0", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(governance, (await keepTrade.tradeDiscountRequirement()), {from: trader});
			await keepTradeToken.transfer(governance, (await keepTrade.keeperL2Requirement()), {from: keeper});
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
		});

		it("should throw error when fill with invalid trade ID", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeETHForTokens(tradeId+1, "100000", { from: keeper }),
				"Invalid trade ID"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});

		it("should throw error when fill with invalid trade type", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader, value: amount });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForETH(tradeId, { from: keeper }),
				"Invalid trade type"
			);

			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForTokens(tradeId, "1000", { from: keeper }),
				"Invalid trade type"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});
	});

	describe('tradeTokensForETH', () => {
		const governance = accounts[0];
		const trader = accounts[1];
		const keeper = accounts[2];
		let traderTokenABeforeBalance;
		let keeperTokenABeforeBalance;
		let governanceEthBeforeBalance;
		let traderKPTRBalance;
		let keeperKPTRBalance;
		let beforeTradeId;
		let beforeCurrentTradeCount;
		let beforeAddressTradeCount;
		beforeEach(async () => {
			traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			governanceEthBeforeBalance = new BN(await web3.eth.getBalance(governance));
			traderTokenABeforeBalance = await tokenA.balanceOf(trader);
			keeperTokenABeforeBalance = await tokenA.balanceOf(keeper);
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
			beforeTradeId = (await keepTrade.tradeIndex()).toNumber();
			beforeCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			beforeAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
		});

		it("should trade correctly when fill at once", async function () {
			const amount = new BN("1000000000000000000"); //1
			const rate = new BN("50000000000000000"); //0.05

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const allowance = await tokenA.allowance(trader, keepTrade.address, { from: trader });
			assert.equal(fromWei(allowance), fromWei(amount), "Token A approve failed");

			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			assert.equal(tradeId, beforeTradeId, "Trade Id should equal to previous trade index");

			const afterTradeId = (await keepTrade.tradeIndex()).toNumber();
			assert.equal(afterTradeId, beforeTradeId + 1, "Trade Id should increased by 1");

			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.TokenToEth, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.fromToken, tokenA.address, "Trade from token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			const fillAmount = await keeperGetAmountIn(keepTrade, amount, keeperKPTRBalance, traderKPTRBalance, rate);

			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount });

			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const governanceEthAfterBalance = new BN(await web3.eth.getBalance(governance));

			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(amount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(fillAmount.sub(traderGetAmountOut(amount, rate)))), "Amount wasn't correctly added to the governance");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when refund required", async function () {
			const amount = new BN("1100");
			const rate = new BN("7000000000000000"); //0.007

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			const trade = await keepTrade.trades(tradeId);
			assert.equal(trade.tradeType.toNumber(), TradeType.TokenToEth, "Trade type should be TokenToToken");
			assert.equal(trade.fromAddress, trader, "Trade should from trader address");
			assert.equal(trade.fromToken, tokenA.address, "Trade from token incorrect");
			assert.equal(fromWei(trade.totalFromAmount), fromWei(amount), "Trade total amount should equal to from amount");
			assert.equal(fromWei(trade.currentFromAmount), fromWei(amount), "Trade current amount should equal to from amount");
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");
			assert.equal(trade.currentTradeIndex.toNumber(), afterCurrentTradeCount - 1 , "Trade currentTradeIndex should be the last index");
			assert.equal(trade.addressTradeIndex.toNumber(), afterAddressTradeCount - 1 , "Trade addressTradeIndex should be the last index");

			//////////////
			//fill
			//////////////
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			const fillAmount = await keeperGetAmountIn(keepTrade, amount, keeperKPTRBalance, traderKPTRBalance, rate);

			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount });

			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const governanceEthAfterBalance = new BN(await web3.eth.getBalance(governance));
			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);

			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(traderGetAmountOut(amount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(new BN("1000"))), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(fillAmount.sub(traderGetAmountOut(amount, rate)))), "Amount wasn't correctly added to the governance");
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(new BN("100"))), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should cancel correctly and refund", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterCurrentTradeLastItem = (await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 1, "Current trade array length should increased by 1");
			assert.equal(afterCurrentTradeLastItem, tradeId, "Current trade array last item should equal to trade Id");

			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			const afterAddressTradeLastItem = (await keepTrade.tradeIdByAddress(trader, afterAddressTradeCount - 1)).toNumber();
			assert.equal(afterAddressTradeCount, beforeAddressTradeCount + 1, "Address trade array length should increased by 1");
			assert.equal(afterAddressTradeLastItem, tradeId, "Address trade array last item should equal to trade Id");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenABeforeBalance), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("30000000000000000"); //0.03

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterBalance), fromWei(traderTokenABeforeBalance.sub(amount)), "Amount wasn't correctly taken from the trader");

			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			const afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const afterAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			const fillAmount = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, rate);

			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount });

			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const governanceEthAfterBalance = new BN(await web3.eth.getBalance(governance));

			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(singleTradeAmount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(fillAmount.sub(traderGetAmountOut(singleTradeAmount, rate)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(amount.sub(singleTradeAmount))), "Amount wasn't correctly refunded to the trader");

			const afterfillCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterfillCurrentTradeCount, afterCurrentTradeCount - 1, "Current trade array length should decreased by 1");

			const afterfillAddressTradeCount = (await keepTrade.getCurrentTradeCountByAddress(trader)).toNumber();
			assert.equal(afterfillAddressTradeCount, afterAddressTradeCount - 1, "Address trade array length should decreased by 1");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should correctly trade -> change rate -> fill -> cancel", async function () {
			const amount = new BN("2000000000000000000"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, oldRate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });
			const trade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(trade.rate), fromWei(rate), "Trade rate not equal");

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("2"));
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));
			const fillAmount = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, rate);

			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount });

			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);
			const governanceEthAfterBalance = new BN(await web3.eth.getBalance(governance));

			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(traderGetAmountOut(singleTradeAmount, rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(singleTradeAmount)), "Amount wasn't correctly added to the keeper");
			assert.equal(fromWei(governanceEthAfterBalance), fromWei(governanceEthBeforeBalance.add(fillAmount.sub(traderGetAmountOut(singleTradeAmount, rate)))), "Amount wasn't correctly added to the governance");

			//////////////
			//Cancel
			//////////////
			await keepTrade.cancelTrades([tradeId], { from: trader });

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(amount.sub(singleTradeAmount))), "Amount wasn't correctly refunded to the trader");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");
		});

		it("should trade correctly when modify requirement / fees / rate / fill at any time", async function () {
			const amount = new BN("2000000000000000010"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			//////////////
			//Set trade
			//////////////
			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, oldRate, { from: trader });
			const traderTokenAAfterBalance = await tokenA.balanceOf(trader);
			const tradeId = tradeInfo.logs[0].args[0].toNumber();

			//////////////
			//fill
			//////////////
			const singleTradeAmount = amount.div(new BN("4"));
			const fillAmount1 = await keeperGetAmountIn(keepTrade, singleTradeAmount, keeperKPTRBalance, traderKPTRBalance, oldRate);
			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount1 });

			//////////////
			//Change rate
			//////////////
			await keepTrade.updateTradeRate(tradeId, rate, { from: trader });

			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("200", "100", "10", "20", "10", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(trader, (await keepTrade.tradeDiscountRequirement()).sub(traderKPTRBalance));
			await keepTradeToken.transfer(keeper, (await keepTrade.keeperL2Requirement()).sub(keeperKPTRBalance));
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);

			//////////////
			//fill
			//////////////
			const fillAmount2 = await keeperGetAmountIn(keepTrade, amount.sub(singleTradeAmount), keeperKPTRBalance, traderKPTRBalance, rate);
			const traderEthBeforeBalance = new BN(await web3.eth.getBalance(trader));

			await keepTrade.fillTradeTokensForETH(tradeId, { from: keeper, value: fillAmount2 });

			const trade = await keepTrade.trades(tradeId);

			const traderTokenAAfterRefundBalance = await tokenA.balanceOf(trader);
			const traderEthAfterBalance = new BN(await web3.eth.getBalance(trader));
			const keeperTokenAAfterBalance = await tokenA.balanceOf(keeper);

			assert.equal(fromWei(traderTokenAAfterRefundBalance), fromWei(traderTokenAAfterBalance.add(new BN("10"))), "Amount wasn't correctly refunded to the trader");
			assert.equal(fromWei(traderEthAfterBalance), fromWei(traderEthBeforeBalance.add(traderGetAmountOut(amount.sub(singleTradeAmount), rate))), "Amount wasn't correctly added to the trader");
			assert.equal(fromWei(keeperTokenAAfterBalance), fromWei(keeperTokenABeforeBalance.add(amount.sub(new BN("10")))), "Amount wasn't correctly added to the keeper");

			const afterfillTrade = await keepTrade.trades(tradeId);
			assert.equal(fromWei(afterfillTrade.totalFromAmount), "0", "Trade should be deleted");

			//////////////
			//Change fees
			//////////////
			await keepTrade.setFees("100", "50", "0", "10", "0", "10000");

			//////////////
			//Change KPTR balance
			//////////////
			await keepTradeToken.transfer(governance, (await keepTrade.tradeDiscountRequirement()), {from: trader});
			await keepTradeToken.transfer(governance, (await keepTrade.keeperL2Requirement()), {from: keeper});
			traderKPTRBalance = await keepTradeToken.balanceOf(trader);
			keeperKPTRBalance = await keepTradeToken.balanceOf(keeper);
		});

		it("should throw error when fill with invalid trade ID", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForETH(tradeId+1, { from: keeper, value: "100000" }),
				"Invalid trade ID"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});

		it("should throw error when fill with invalid trade type", async function () {
			const amount = new BN("2000000000000000010"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });
			const tradeInfo = await keepTrade.tradeTokensForETH(tokenA.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();


			await truffleAssert.reverts(
				keepTrade.fillTradeTokensForTokens(tradeId, "1000", { from: keeper }),
				"Invalid trade type"
			);

			await truffleAssert.reverts(
				keepTrade.fillTradeETHForTokens(tradeId, "1000", { from: keeper }),
				"Invalid trade type"
			);

			await keepTrade.cancelTrades([tradeId], { from: trader });
		});
	});


	describe('Update rate', () => {
		it("should revert if not trade owner", async function () {
			const trader = accounts[1];
			const amount = new BN("2000000000000000000"); //2
			const oldRate = new BN("30000000000000000"); //0.03
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, oldRate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			await truffleAssert.reverts(
				keepTrade.updateTradeRate(tradeId, rate),
				"Only trade owner could change rate"
			);
		});
	});

	describe('Cancel trade from trader', () => {
		it("should revert if not trade owner", async function () {
			const trader = accounts[1];
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			await truffleAssert.reverts(
				keepTrade.cancelTrades([tradeId]),
				"Only trade owner could cancel trade"
			);
		});
	});

	describe('Cancel trade from owner', () => {
		it("should revert if not owner", async function () {
			const trader = accounts[1];
			const trader2 = accounts[3];
			const amount = new BN("2000000000000000000"); //2
			const rate = new BN("40000000000000000"); //0.04

			await tokenA.approve(keepTrade.address, amount, { from: trader });

			const tradeInfo = await keepTrade.tradeTokensForTokens(tokenA.address, tokenB.address, amount, rate, { from: trader });
			const tradeId = tradeInfo.logs[0].args[0].toNumber();
			await truffleAssert.reverts(
				keepTrade.cancelTradesFromOwner([tradeId], { from: trader2 }),
				"Ownable: caller is not the owner."
			);
		});
	});

	describe('Trade index', () => {
		it("should as expect with multiple set and cancel", async function () {
			const owner = accounts[0];
			const trader1 = accounts[1];
			const trader2 = accounts[3];
			const trader3 = accounts[4];
			const amount = new BN("1000000000000000000"); //1
			const rate = new BN("50000000000000000"); //0.05
			const beforeCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			const beforeAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber();
			const beforeAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber();
			const beforeAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber();

			///////////
			//Set 4 (1,2,3,4)
			///////////
			const tradeInfo1 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader1, value: amount });
			const tradeInfo2 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader1, value: amount });
			const tradeInfo3 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader2, value: amount });
			const tradeInfo4 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader3, value: amount });
			const tradeId1 = tradeInfo1.logs[0].args[0].toNumber();
			const tradeId2 = tradeInfo2.logs[0].args[0].toNumber();
			const tradeId3 = tradeInfo3.logs[0].args[0].toNumber();
			const tradeId4 = tradeInfo4.logs[0].args[0].toNumber();
			let afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 4, "Current trade array length should match");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 4)).toNumber(), tradeId1, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 3)).toNumber(), tradeId2, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 2)).toNumber(), tradeId3, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber(), tradeId4, "Current trade array item should match trade Id");

			let afterAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber()
			let afterAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber()
			let afterAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber()
			assert.equal(afterAddressTradeCount1, beforeAddressTradeCount1 + 2, "Current trade array length should match");
			assert.equal(afterAddressTradeCount2, beforeAddressTradeCount2 + 1, "Current trade array length should match");
			assert.equal(afterAddressTradeCount3, beforeAddressTradeCount3 + 1, "Current trade array length should match");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 2)).toNumber(), tradeId1, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 1)).toNumber(), tradeId2, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader2, afterAddressTradeCount2 - 1)).toNumber(), tradeId3, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader3, afterAddressTradeCount3 - 1)).toNumber(), tradeId4, "Current trade array item should match trade Id");

			///////////
			//Cancel 2, set 1 (4,2,5)
			///////////
			await keepTrade.cancelTrades([tradeId1], { from: trader1 });
			await keepTrade.cancelTrades([tradeId3], { from: trader2 });
			const tradeInfo5 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader1, value: amount });
			const tradeId5 = tradeInfo5.logs[0].args[0].toNumber();

			afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 3, "Current trade array length should match");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 3)).toNumber(), tradeId4, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 2)).toNumber(), tradeId2, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber(), tradeId5, "Current trade array item should match trade Id");

			afterAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber()
			afterAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber()
			afterAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber()
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber(), beforeAddressTradeCount1 + 2, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber(), beforeAddressTradeCount2 + 0, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber(), beforeAddressTradeCount3 + 1, "Current trade array length should match");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 2)).toNumber(), tradeId2, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 1)).toNumber(), tradeId5, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader3, afterAddressTradeCount3 - 1)).toNumber(), tradeId4, "Current trade array item should match trade Id");

			///////////
			//Set 2, cancel 2 (4,7,6)
			///////////
			const tradeInfo6 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader2, value: amount });
			const tradeInfo7 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader3, value: amount });
			const tradeId6 = tradeInfo6.logs[0].args[0].toNumber();
			const tradeId7 = tradeInfo7.logs[0].args[0].toNumber();
			await keepTrade.cancelTradesFromOwner([tradeId2, tradeId5], { from: owner });

			afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 3, "Current trade array length should match");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 3)).toNumber(), tradeId4, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 2)).toNumber(), tradeId7, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber(), tradeId6, "Current trade array item should match trade Id");

			afterAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber()
			afterAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber()
			afterAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber()
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber(), beforeAddressTradeCount1 + 0, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber(), beforeAddressTradeCount2 + 1, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber(), beforeAddressTradeCount3 + 2, "Current trade array length should match");
			assert.equal((await keepTrade.tradeIdByAddress(trader2, afterAddressTradeCount2 - 1)).toNumber(), tradeId6, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader3, afterAddressTradeCount3 - 2)).toNumber(), tradeId4, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader3, afterAddressTradeCount3 - 1)).toNumber(), tradeId7, "Current trade array item should match trade Id");


			///////////
			//Cancel 1, cancel 2
			///////////
			await keepTrade.cancelTradesFromOwner([tradeId6], { from: owner });
			await keepTrade.cancelTrades([tradeId4, tradeId7], { from: trader3 });
			afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 0, "Current trade array length should match");
			afterAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber()
			afterAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber()
			afterAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber()
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber(), beforeAddressTradeCount1 + 0, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber(), beforeAddressTradeCount2 + 0, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber(), beforeAddressTradeCount3 + 0, "Current trade array length should match");
			///////////
			//Set 2, set 1
			///////////
			const tradeInfo8 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader1, value: amount });
			const tradeInfo9 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader1, value: amount });
			const tradeInfo10 = await keepTrade.tradeETHForTokens(tokenB.address, rate, { from: trader3, value: amount });
			const tradeId8 = tradeInfo8.logs[0].args[0].toNumber();
			const tradeId9 = tradeInfo9.logs[0].args[0].toNumber();
			const tradeId10 = tradeInfo10.logs[0].args[0].toNumber();

			afterCurrentTradeCount = (await keepTrade.getCurrentTradeCount()).toNumber();
			assert.equal(afterCurrentTradeCount, beforeCurrentTradeCount + 3, "Current trade array length should match");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 3)).toNumber(), tradeId8, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 2)).toNumber(), tradeId9, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.currentTrades(afterCurrentTradeCount - 1)).toNumber(), tradeId10, "Current trade array item should match trade Id");

			afterAddressTradeCount1 = (await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber()
			afterAddressTradeCount2 = (await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber()
			afterAddressTradeCount3 = (await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber()
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader1)).toNumber(), beforeAddressTradeCount1 + 2, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader2)).toNumber(), beforeAddressTradeCount2 + 0, "Current trade array length should match");
			assert.equal((await keepTrade.getCurrentTradeCountByAddress(trader3)).toNumber(), beforeAddressTradeCount3 + 1, "Current trade array length should match");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 2)).toNumber(), tradeId8, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader1, afterAddressTradeCount1 - 1)).toNumber(), tradeId9, "Current trade array item should match trade Id");
			assert.equal((await keepTrade.tradeIdByAddress(trader3, afterAddressTradeCount3 - 1)).toNumber(), tradeId10, "Current trade array item should match trade Id");
		});
	});

});
