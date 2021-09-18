// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import "contracts/IKeepTradeGovern.sol";

contract KeepTradeV1Core is Ownable, ReentrancyGuard{
	using Address for address;

	struct Trade {
		uint256 totalFromAmount;
		uint256 currentFromAmount;
		uint256 rate;
		uint256 currentTradeIndex;
		uint256 addressTradeIndex;
		address fromAddress;
		address fromToken;
		address toToken;
		TradeType tradeType;
	}

	uint256 public tradeIndex;
	uint256[] public currentTrades;
	mapping(uint256 => Trade) public trades;
    mapping(address => uint256[]) public tradeIdByAddress;

	IERC20 public immutable keepTradeToken;
	address public governance;
	enum TradeType {EthToToken, TokenToToken, TokenToEth}

	uint256 public keeperL1Requirement;
	uint256 public keeperL2Requirement;
	uint256 public keeperL3Requirement;
	uint256 public tradeDiscountRequirement;

	uint256 public keeperL1FeeMul;
	uint256 public keeperL2FeeMul;
	uint256 public keeperL3FeeMul;

	uint256 public tradeBasicFeeMul;
	uint256 public tradeDiscountFeeMul;
	uint256 public feeBase;


	event newTrade(
		uint256 indexed index,
		TradeType tradeType,
		address indexed fromAddress,
		address fromToken,
		address toToken,
		uint256 fromAmount,
		uint256 rate
		);

	event fillTrade(
		uint256 indexed tradeIndex,
		address indexed keeperAddress,
		uint256 amount
	);

	event removeTrade(
		uint256 indexed tradeIndex
	);

	event updateGovernance(
		address indexed governance
	);

	event updateFees(
		uint256 keeperL1FeeMul,
		uint256 keeperL2FeeMul,
		uint256 keeperL3FeeMul,
		uint256 tradeBasicFeeMul,
		uint256 tradeDiscountFeeMul,
		uint256 _feeBase
	);

	event updateRequirements(
		uint256 keeperL1Requirement,
		uint256 keeperL2Requirement,
		uint256 keeperL3Requirement,
		uint256 tradeDiscountRequirement
	);

	constructor(
		address _keepTrade,
		uint256 _keeperL1FeeMul,
		uint256 _keeperL2FeeMul,
		uint256 _keeperL3FeeMul,
		uint256 _tradeBasicFeeMul,
		uint256 _tradeDiscountFeeMul,
		uint256 _feeBase,
		uint256 _keeperL1Requirement,
		uint256 _keeperL2Requirement,
		uint256 _keeperL3Requirement,
		uint256 _tradeDiscountRequirement
		) {
		tradeIndex = 0;
		governance = msg.sender;
		keepTradeToken = IERC20(_keepTrade);
		keeperL1FeeMul = _keeperL1FeeMul;
		keeperL2FeeMul = _keeperL2FeeMul;
		keeperL3FeeMul = _keeperL3FeeMul;
		tradeBasicFeeMul = _tradeBasicFeeMul;
		tradeDiscountFeeMul = _tradeDiscountFeeMul;
		feeBase = _feeBase;
		keeperL1Requirement = _keeperL1Requirement;
		keeperL2Requirement = _keeperL2Requirement;
		keeperL3Requirement = _keeperL3Requirement;
		tradeDiscountRequirement = _tradeDiscountRequirement;
	}

	/*************
	External function
	*************/

	function tradeETHForTokens(address toToken,uint256 rate) external payable nonReentrant returns (uint256) {
		require(msg.value > 0, "Invalid input ETH amount");
		require(rate > 0, "Invalid rate: 0");
		require(msg.value * rate >= 10**18, "Invalid rate");
		require(toToken != address(0), "Invalid to token");

		return _setTrade(TradeType.EthToToken, msg.sender, address(0), toToken, msg.value, rate);
	}

	function tradeTokensForTokens(address fromToken, address toToken, uint256 amount, uint256 rate) external nonReentrant returns (uint256) {
		require(amount > 0, "Invalid input token amount");
		require(rate > 0, "Rate zero error");
		require(amount * rate >= 10**18, "Invalid rate");
		require(fromToken != address(0), "Invalid from token");
		require(toToken != address(0), "Invalid to token");
		require(fromToken != toToken, "Invalid token pair");

		uint256 beforeBalance = IERC20(fromToken).balanceOf(address(this));
		TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), amount);
		uint256 afterBalance = IERC20(fromToken).balanceOf(address(this));
		amount = afterBalance - beforeBalance;

		return _setTrade(TradeType.TokenToToken, msg.sender, fromToken, toToken, amount, rate);
	}

	function tradeTokensForETH(address fromToken, uint256 amount, uint256 rate) external nonReentrant returns (uint256) {
		require(amount > 0, "Invalid input token amount");
		require(rate > 0, "Rate zero error");
		require(amount * rate >= 10**18, "Invalid rate");
		require(fromToken != address(0), "Invalid from token");

		uint256 beforeBalance = IERC20(fromToken).balanceOf(address(this));
		TransferHelper.safeTransferFrom(fromToken, msg.sender, address(this), amount);
		uint256 afterBalance = IERC20(fromToken).balanceOf(address(this));
		amount = afterBalance - beforeBalance;

		return _setTrade(TradeType.TokenToEth, msg.sender, fromToken, address(0), amount, rate);
	}

	// Return the amount keeper got
	function fillTradeTokensForTokens(uint256 tradeId, uint256 amount) external nonReentrant returns (uint256) {
		require(amount > 0, "Invalid input token amount");

		Trade memory trade = trades[tradeId];
		require(trade.currentFromAmount > 0, "Invalid trade ID");
		require(trade.tradeType == TradeType.TokenToToken, "Invalid trade type");

		address _toToken = trade.toToken;
		address _fromAddress = trade.fromAddress;
		uint256 _rate = trade.rate;

		// Calculate fees
		uint256 amountAfterFees = _calTradeFee(msg.sender, _fromAddress, amount);

		// Send fees to governance
		uint _fees = amount - amountAfterFees;
		if (_fees > 0) {
			TransferHelper.safeTransferFrom(_toToken, msg.sender, governance, _fees);
		}

		// Send token to trader
		uint256 beforeBalance = IERC20(_toToken).balanceOf(_fromAddress);
		TransferHelper.safeTransferFrom(_toToken, msg.sender, _fromAddress, amountAfterFees);
		uint256 afterBalance = IERC20(_toToken).balanceOf(_fromAddress);
		uint256 amountToKeeper = (afterBalance - beforeBalance) * (10**18) / _rate;

		// Modify trade data
		trade.currentFromAmount = _fillTrade(tradeId, trade.currentFromAmount, amountToKeeper);

		// Send token to keeper
		TransferHelper.safeTransfer(trade.fromToken, msg.sender, amountToKeeper);

		// Trade finished
		if(trade.currentFromAmount * _rate < 10**18) {
			_finishTrade(tradeId, trade);
		}

		return amountToKeeper;
	}

	// Return the amount keeper got
	function fillTradeETHForTokens(uint256 tradeId, uint256 amount) external nonReentrant returns (uint256) {
		require(amount > 0, "Invalid input token amount");

		Trade memory trade = trades[tradeId];
		require(trade.currentFromAmount > 0, "Invalid trade ID");
		require(trade.tradeType == TradeType.EthToToken, "Invalid trade type");

		address _toToken = trade.toToken;
		address _fromAddress = trade.fromAddress;
		uint256 _rate = trade.rate;

		// Send token to trader
		uint256 beforeBalance = IERC20(_toToken).balanceOf(_fromAddress);
		TransferHelper.safeTransferFrom(_toToken, msg.sender, _fromAddress, amount);
		uint256 afterBalance = IERC20(_toToken).balanceOf(_fromAddress);
		uint256 amountETH = (afterBalance - beforeBalance) * (10**18) / _rate;

		// Modify trade data
		trade.currentFromAmount = _fillTrade(tradeId, trade.currentFromAmount, amountETH);

		// Calculate fees
		uint256 amountAfterFees = _calTradeFee(msg.sender, _fromAddress, amountETH);

		// Send fees to governance
		uint _fees = amountETH - amountAfterFees;
		if (_fees > 0) {
			_depositEthToGovernance(_fees);
		}

		// Send token to keeper
		TransferHelper.safeTransferETH(msg.sender, amountAfterFees);

		// Trade finished
		if(trade.currentFromAmount * _rate < 10**18) {
			_finishTrade(tradeId, trade);
		}

		return amountAfterFees;
	}

	// Return the amount keeper got
	function fillTradeTokensForETH(uint256 tradeId) external payable nonReentrant returns (uint256) {
		Trade memory trade = trades[tradeId];
		require(trade.currentFromAmount > 0, "Invalid trade ID");
		require(trade.tradeType == TradeType.TokenToEth, "Invalid trade type");

		address _fromAddress = trade.fromAddress;
		uint256 _rate = trade.rate;

		// Calculate fees
		uint256 amountAfterFees = _calTradeFee(msg.sender, _fromAddress, msg.value);

		// Send fees to governance
		uint _fees = msg.value - amountAfterFees;
		if (_fees > 0) {
			_depositEthToGovernance(_fees);
		}

		// Send token to trader
		TransferHelper.safeTransferETH(_fromAddress, amountAfterFees);
		uint256 amountToKeeper = amountAfterFees * (10**18) / _rate;

		// Modify trade data
		trade.currentFromAmount = _fillTrade(tradeId, trade.currentFromAmount, amountToKeeper);

		// Send token to keeper
		TransferHelper.safeTransfer(trade.fromToken, msg.sender, amountToKeeper);

		// Trade finished
		if(trade.currentFromAmount * _rate < 10**18) {
			_finishTrade(tradeId, trade);
		}

		return amountToKeeper;
	}

	function updateTradeRate (uint256 tradeId, uint256 _rate) external nonReentrant {
		require(trades[tradeId].currentFromAmount > 0, "Invalid trade ID");
		require(trades[tradeId].fromAddress == msg.sender, "Only trade owner could change rate");
		require(_rate > 0, "Rate zero error");
		require(trades[tradeId].currentFromAmount * _rate >= 10**18, "Invalid rate");

		trades[tradeId].rate = _rate;
	}

	function cancelTrades(uint256[] calldata tradeIds) external nonReentrant {
		for (uint256 i=0; i < tradeIds.length; i++) {
			uint256 tradeId = tradeIds[i];
			Trade memory trade = trades[tradeId];
			require(trade.currentFromAmount > 0, "Invalid trade ID");
			require(trade.fromAddress == msg.sender, "Only trade owner could cancel trade");
			_finishTrade(tradeId, trade);
		}
	}

	/*************
	View function
	*************/

	function getCurrentTradeCount() public view returns (uint256 count) {
		count = currentTrades.length;
	}

	function getCurrentTradeCountByAddress(address trader) public view returns (uint256 count) {
		count = tradeIdByAddress[trader].length;
	}

	function getCurrentTrades() external view returns (uint256[] memory) {
        return currentTrades;
    }

	function getTradesByAddress(address trader) external view returns (uint256[] memory) {
        return tradeIdByAddress[trader];
    }

	/*************
	Owner function
	*************/

	function cancelTradesFromOwner(uint256[] calldata tradeIds) external onlyOwner {
		for (uint256 i=0; i < tradeIds.length; i++) {
			uint256 tradeId = tradeIds[i];
			Trade memory trade = trades[tradeId];
			if (trade.currentFromAmount <= 0) {
				continue;
			}
			_finishTrade(tradeId, trade);
		}
	}

	function setFees(uint256 _keeperL1FeeMul, uint256 _keeperL2FeeMul, uint256 _keeperL3FeeMul, uint256 _tradeBasicFeeMul, uint256 _tradeDiscountFeeMul, uint256 _feeBase) external onlyOwner {
		require(_keeperL1FeeMul < _feeBase && _tradeBasicFeeMul < _feeBase, "Fee Base input error.");
		require(_keeperL1FeeMul >= _keeperL2FeeMul && _keeperL2FeeMul >= _keeperL3FeeMul, "Keeper fees should be in order.");
		require(_tradeBasicFeeMul >= _tradeDiscountFeeMul, "Trade fees should be in order.");
		keeperL1FeeMul = _keeperL1FeeMul;
		keeperL2FeeMul = _keeperL2FeeMul;
		keeperL3FeeMul = _keeperL3FeeMul;
		tradeBasicFeeMul = _tradeBasicFeeMul;
		tradeDiscountFeeMul = _tradeDiscountFeeMul;
		feeBase = _feeBase;
		emit updateFees(keeperL1FeeMul, keeperL2FeeMul, keeperL3FeeMul, tradeBasicFeeMul, tradeDiscountFeeMul, feeBase);
    }

	function setRequirements(uint256 _keeperL1Requirement, uint256 _keeperL2Requirement, uint256 _keeperL3Requirement, uint256 _tradeDiscountRequirement) external onlyOwner {
		require(_keeperL1Requirement <= _keeperL2Requirement && _keeperL2Requirement <= _keeperL3Requirement, "Requirement levels should be in order.");
		keeperL1Requirement = _keeperL1Requirement;
		keeperL2Requirement = _keeperL2Requirement;
		keeperL3Requirement = _keeperL3Requirement;
		tradeDiscountRequirement = _tradeDiscountRequirement;
		emit updateRequirements(keeperL1Requirement, keeperL2Requirement, keeperL3Requirement, tradeDiscountRequirement);
    }

	function setGovernance(address _governance) external onlyOwner {
        governance = _governance;
		emit updateGovernance(governance);
    }

	/*************
	Private function
	*************/

	function _setTrade(TradeType _tradeType, address _fromAddress, address _fromToken, address _toToken, uint256 _totalFromAmount, uint256 _rate) private returns (uint256) {
		Trade storage trade = trades[tradeIndex];
		trade.tradeType = _tradeType;
		trade.fromAddress = _fromAddress;
		if (_fromToken != address(0)) {
			trade.fromToken = _fromToken;
		}
		if (_toToken != address(0)) {
			trade.toToken = _toToken;
		}
		trade.totalFromAmount = _totalFromAmount;
		trade.currentFromAmount = _totalFromAmount;
		trade.rate = _rate;

		trade.currentTradeIndex = currentTrades.length;
		trade.addressTradeIndex = tradeIdByAddress[_fromAddress].length;

		currentTrades.push(tradeIndex);
		tradeIdByAddress[_fromAddress].push(tradeIndex);

		emit newTrade(tradeIndex, _tradeType, _fromAddress, _fromToken, _toToken, _totalFromAmount, _rate);

		tradeIndex ++;
		return tradeIndex-1;
	}

	function _fillTrade(uint256 tradeId, uint256 currentAmount, uint256 fillAmount) private returns (uint256 newCurrentAmount) {
		require(currentAmount >= fillAmount, "Invalid trade amount");
		newCurrentAmount = currentAmount - fillAmount;
		trades[tradeId].currentFromAmount = newCurrentAmount;
		emit fillTrade(tradeId, msg.sender ,fillAmount);
	}

	function _finishTrade(uint256 tradeId, Trade memory trade) private {
		if (trade.currentFromAmount > 0) {
			if (trade.tradeType == TradeType.EthToToken) {
				TransferHelper.safeTransferETH(trade.fromAddress, trade.currentFromAmount);
			} else {
				TransferHelper.safeTransfer(trade.fromToken,trade.fromAddress, trade.currentFromAmount);
			}
		}
		uint256 _currentTradesLength  = currentTrades.length;
		if (_currentTradesLength > 1) {
			uint256 lastTrade = currentTrades[_currentTradesLength-1];
			currentTrades[trade.currentTradeIndex] = lastTrade;
			trades[lastTrade].currentTradeIndex = trade.currentTradeIndex;
		}
		currentTrades.pop();

		uint256[] storage traderCurrentTrades = tradeIdByAddress[trade.fromAddress];
		uint256 _tradeByAddressLength  = traderCurrentTrades.length;
		if (_tradeByAddressLength > 1) {
			uint256 lastAddressTrade = traderCurrentTrades[_tradeByAddressLength-1];
			traderCurrentTrades[trade.addressTradeIndex] = lastAddressTrade;
			trades[lastAddressTrade].addressTradeIndex = trade.addressTradeIndex;
		}
		traderCurrentTrades.pop();

		delete trades[tradeId];
		emit removeTrade(tradeId);
	}

	function _calTradeFee(address _keeper, address _trader, uint256 amount) private view returns (uint256) {
		uint256 keeperKeepTradeBalance = keepTradeToken.balanceOf(_keeper);
		require(keeperKeepTradeBalance >= keeperL1Requirement, "Keeper should hold minimum KeepTrade Token");
		uint256 traderKeepTradeBalance = keepTradeToken.balanceOf(_trader);

		uint256 _feeBase = feeBase;
		if (keeperKeepTradeBalance < keeperL2Requirement) {
			amount = amount - (amount * keeperL1FeeMul / _feeBase); // keeper L1
		} else if (keeperKeepTradeBalance < keeperL3Requirement) {
			amount = amount - (amount * keeperL2FeeMul / _feeBase); // keeper L2
		} else {
			amount = amount - (amount * keeperL3FeeMul / _feeBase); // keeper L3
		}

		if (traderKeepTradeBalance < tradeDiscountRequirement) {
			amount = amount - (amount * tradeBasicFeeMul / _feeBase); // trader basic
		} else {
			amount = amount - (amount * tradeDiscountFeeMul / _feeBase); // trader discount
		}
		return amount;
	}

	//TODO gas optimize
	function _depositEthToGovernance(uint256 amount) private {
		address _governance = governance;
		if (_governance.isContract()) {
			IKeepTradeGovern(_governance).depositEth{value: amount}();
		} else {
			TransferHelper.safeTransferETH(_governance, amount);
		}
	}
}