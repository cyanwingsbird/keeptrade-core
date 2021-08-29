require('dotenv').config()
const HDWalletProvider = require('@truffle/hdwallet-provider');

const infuraKey = process.env.INFURAKEY;
const privateKey = process.env.TEST_WALLET_KEY;
const etherScanKey = process.env.ETHERSCAN_KEY;

module.exports = {
  networks: {
	development: {
	  host: "127.0.0.1",
	  port: 7545,
	  network_id: "*"
	},
	test: {
	  host: "127.0.0.1",
	  port: 7545,
	  network_id: "*"
	},
	ropsten: {
		provider: () => new HDWalletProvider([privateKey], `https://ropsten.infura.io/v3/` + infuraKey),
		network_id: 3,       // Ropsten's id
		gas: 5500000,        // Ropsten has a lower block limit than mainnet
		confirmations: 2,    // # of confs to wait between deployments. (default: 0)
		timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
		skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
       version: "0.8.7",    // Fetch exact version from solc-bin (default: truffle's version)
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: etherScanKey
  }
};
