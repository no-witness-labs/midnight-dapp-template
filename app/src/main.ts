/**
 * Midnight dApp - Counter Contract Example
 *
 * Demonstrates how to connect to the Lace wallet in a browser environment
 * and deploy/interact with a counter contract.
 *
 * Prerequisites:
 * - Lace wallet browser extension installed
 * - Local devnet running (cd devnet && pnpm start) OR Preview network access
 */
import * as Midday from '@no-witness-labs/midday-sdk';
import * as CounterContract from '../../contracts/counter/contract/index.js';

// Store connected wallet API for balance queries
let connectedApi: Midday.BrowserWallet.ConnectedAPI | null = null;

// UI Elements
const networkSelect = document.getElementById('network-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const addressDiv = document.getElementById('address') as HTMLDivElement;
const actionsDiv = document.getElementById('actions') as HTMLDivElement;
const counterDiv = document.getElementById('counter-value') as HTMLDivElement;

// State
let client: Midday.Client.MiddayClient | null = null;
let contract: Midday.Client.Contract | null = null;
let lacePublicKey: string = '';
let laceEncryptionKey: string = '';

// Update status display
function updateStatus(message: string, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = isError ? 'error' : 'success';
}

// Update counter display
function updateCounter(value: number | string) {
  if (counterDiv) {
    counterDiv.textContent = `Counter: ${value}`;
    counterDiv.style.display = 'block';
  }
}

// Connect to Lace wallet
async function connectWallet() {
  try {
    updateStatus('Connecting to Lace wallet...');
    connectBtn.disabled = true;

    const network = networkSelect?.value || 'undeployed';
    const connection = await Midday.BrowserWallet.connectWallet(network as 'preview' | 'undeployed');

    updateStatus('Creating SDK client...');

    const useFeeRelay = (document.getElementById('fee-relay-checkbox') as HTMLInputElement).checked;

    client = await Midday.Client.fromWallet(connection, {
      privateStateProvider: Midday.PrivateState.indexedDBPrivateStateProvider({
        privateStateStoreName: 'midnight-dapp-counter',
      }),
      ...(useFeeRelay ? { feeRelay: { url: 'http://localhost:3002' } } : {}),
    });

    connectedApi = connection.wallet;
    lacePublicKey = connection.addresses.shieldedCoinPublicKey;
    laceEncryptionKey = connection.addresses.shieldedEncryptionPublicKey;

    addressDiv.textContent = `Connected: ${lacePublicKey.slice(0, 16)}...`;
    addressDiv.style.display = 'block';
    actionsDiv.style.display = 'block';

    (document.getElementById('fee-relay-checkbox') as HTMLInputElement).disabled = true;

    updateStatus(`Connected successfully! (${useFeeRelay ? 'fee relay' : 'own dust'})`);
    connectBtn.textContent = 'Connected';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Connection failed: ${message}`, true);
    connectBtn.disabled = false;
  }
}

// Deploy a contract
async function deployContract() {
  if (!client) {
    updateStatus('Not connected', true);
    return;
  }

  try {
    updateStatus('Loading contract...');

    const zkConfigUrl = '/zk-config';

    contract = await client.loadContract({
      module: CounterContract,
      zkConfig: new Midday.ZkConfig.HttpZkConfigProvider(zkConfigUrl),
      privateStateId: 'midnight-dapp-counter',
    });

    updateStatus('Deploying contract...');
    await contract.deploy();

    updateStatus(`Contract deployed at: ${contract.address}`);
    updateCounter('0');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Deploy failed: ${message}`, true);
  }
}

// Call increment action
async function callAction() {
  if (!client || !contract) {
    updateStatus('No contract deployed', true);
    return;
  }

  try {
    updateStatus('Calling increment...');
    const result = await contract.call('increment');
    updateStatus(`TX submitted: ${result.txHash.slice(0, 16)}...`);

    await readState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Call failed: ${message}`, true);
  }
}

// Read contract state
async function readState() {
  if (!client || !contract) {
    updateStatus('No contract deployed', true);
    return;
  }

  try {
    updateStatus('Reading state...');
    const state = (await contract.ledgerState()) as { counter: bigint };
    updateCounter(state.counter.toString());
    updateStatus('State read successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Read failed: ${message}`, true);
  }
}

// Format balance for display (convert from smallest unit)
function formatBalance(value: bigint): string {
  const whole = value / 1_000_000_000n;
  const frac = value % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

// Refresh and display wallet balances
async function refreshBalance() {
  if (!connectedApi) {
    updateStatus('Not connected - connect wallet first', true);
    return;
  }

  try {
    updateStatus('Fetching balances...');

    const [shielded, unshielded, dust] = await Promise.all([
      connectedApi.getShieldedBalances(),
      connectedApi.getUnshieldedBalances(),
      connectedApi.getDustBalance(),
    ]);

    const shieldedKeys = Object.keys(shielded);
    const unshieldedKeys = Object.keys(unshielded);
    const shieldedNative = shielded[''] ?? (shieldedKeys.length > 0 ? shielded[shieldedKeys[0]] : 0n);
    const unshieldedNative = unshielded[''] ?? (unshieldedKeys.length > 0 ? unshielded[unshieldedKeys[0]] : 0n);

    const balanceInfo = document.getElementById('balance-info');
    const shieldedEl = document.getElementById('shielded-balance');
    const unshieldedEl = document.getElementById('unshielded-balance');
    const dustBalanceEl = document.getElementById('dust-balance');
    const dustCapEl = document.getElementById('dust-cap');

    if (balanceInfo) balanceInfo.style.display = 'block';
    if (shieldedEl) shieldedEl.textContent = formatBalance(shieldedNative);
    if (unshieldedEl) unshieldedEl.textContent = formatBalance(unshieldedNative);
    if (dustBalanceEl) dustBalanceEl.textContent = formatBalance(dust.balance);
    if (dustCapEl) dustCapEl.textContent = formatBalance(dust.cap);

    updateStatus('Balances updated');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Failed to get balances: ${message}`, true);
  }
}

// Fund wallet via faucet
async function fundWallet() {
  if (!lacePublicKey || !laceEncryptionKey) {
    updateStatus('Not connected - connect wallet first', true);
    return;
  }

  try {
    updateStatus('Requesting funds from faucet...');

    const response = await fetch('http://localhost:3001/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coinPublicKey: lacePublicKey,
        encryptionPublicKey: laceEncryptionKey,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      updateStatus(`Faucet error: ${data.error}`, true);
      return;
    }

    updateStatus(`Funded! TX: ${data.txId.slice(0, 16)}... (${data.amount} native tokens)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Faucet failed: ${message}`, true);
  }
}

// Set up event listeners
connectBtn.addEventListener('click', connectWallet);

// Export for global access (used by onclick in HTML)
(window as unknown as { deployContract: typeof deployContract }).deployContract = deployContract;
(window as unknown as { callAction: typeof callAction }).callAction = callAction;
(window as unknown as { readState: typeof readState }).readState = readState;
(window as unknown as { refreshBalance: typeof refreshBalance }).refreshBalance = refreshBalance;
(window as unknown as { fundWallet: typeof fundWallet }).fundWallet = fundWallet;

// Initial status
updateStatus('Select network and click "Connect Wallet" to begin');
