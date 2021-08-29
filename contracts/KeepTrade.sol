// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract KeepTrade is ERC20Burnable {
    constructor(uint256 initialSupply) ERC20("KeepTrade", "KPTR") {
        _mint(msg.sender, initialSupply);
    }
}