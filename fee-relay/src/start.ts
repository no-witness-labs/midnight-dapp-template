/**
 * Standalone fee relay server.
 *
 * Converts a 24-word BIP39 mnemonic to a wallet seed and starts
 * a fee relay HTTP server that balances/submits transactions on
 * behalf of browser wallets.
 *
 * Environment variables:
 *   MNEMONIC      — 24-word BIP39 mnemonic (required)
 *   NETWORK       — Network name: local, preview, preprod (default: preview)
 *   PORT          — Server port (default: 3002)
 *   PROOF_SERVER  — Proof server URL (default: http://localhost:6300)
 *
 * Prerequisites:
 *   A proof server must be running (default: localhost:6300).
 *   Start one with: docker run -p 6300:6300 bricktowers/proof-server:7.0.0
 *
 * Usage:
 *   MNEMONIC="word1 word2 ... word24" NETWORK=preview pnpm start
 */
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as Midday from '@no-witness-labs/midday-sdk';
import { FeeRelay } from '@no-witness-labs/midday-sdk/devnet';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const mnemonic = process.env.MNEMONIC?.trim();
if (!mnemonic) {
  console.error('Error: MNEMONIC environment variable is required.');
  console.error('Usage: MNEMONIC="word1 word2 ... word24" NETWORK=preview pnpm start');
  process.exit(1);
}

if (!validateMnemonic(mnemonic, wordlist)) {
  console.error('Error: Invalid mnemonic phrase.');
  process.exit(1);
}

const networkName = process.env.NETWORK || 'preview';
const port = parseInt(process.env.PORT || '3002', 10);

let networkConfig: Midday.Config.NetworkConfig;
try {
  networkConfig = Midday.Config.getNetworkConfig(networkName);
} catch {
  console.error(`Error: Unknown network "${networkName}". Available: local, preview, preprod`);
  process.exit(1);
}

// Override proof server URL if provided
if (process.env.PROOF_SERVER) {
  networkConfig = { ...networkConfig, proofServer: process.env.PROOF_SERVER };
}

// Convert mnemonic to seed (64 bytes)
const seedBytes = mnemonicToSeedSync(mnemonic);
const seed = bytesToHex(seedBytes);

console.log('Starting fee relay server...');
console.log(`  Network: ${networkName} (${networkConfig.networkId})`);
console.log(`  Port: ${port}`);
console.log(`  Node: ${networkConfig.node}`);
console.log(`  Indexer: ${networkConfig.indexer}`);
console.log(`  Proof Server: ${networkConfig.proofServer}`);

const server = FeeRelay.startServer(networkConfig, { port, seed });

console.log(`\nFee relay running at http://localhost:${port}`);
console.log('Endpoints:');
console.log('  POST /balance-tx — balance and sign transactions');
console.log('  POST /submit-tx  — submit finalized transactions');
console.log('  GET  /health     — health check');
console.log('\nPress Ctrl+C to stop.');

process.on('SIGINT', () => {
  console.log('\nStopping fee relay...');
  server.close();
  process.exit(0);
});

// MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon diesel" NETWORK=preprod PROOF_SERVER=http://localhost:6300 PORT=3002 pnpm start
