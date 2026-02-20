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

// UI Elements
const networkSelect = document.getElementById('network-select') as HTMLSelectElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const addressDiv = document.getElementById('address') as HTMLDivElement;
const actionsDiv = document.getElementById('actions') as HTMLDivElement;
const counterDiv = document.getElementById('counter-value') as HTMLDivElement;

// State
let wallet: Midday.Wallet.ConnectedWallet | null = null;
let client: Midday.Client.MiddayClient | null = null;
let contract: Midday.Contract.DeployedContract | null = null;

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
    wallet = await Midday.Wallet.fromBrowser(network);

    updateStatus('Creating SDK client...');

    const useFeeRelay = (document.getElementById('fee-relay-checkbox') as HTMLInputElement).checked;
    const networkName = network === 'undeployed' ? 'local' : network;

    const networkConfig = Midday.Config.getNetworkConfig(networkName);

    // Fee relay: use URL from input
    let feeRelayConfig: { url: string } | undefined;
    if (useFeeRelay) {
      const urlInput = document.getElementById('fee-relay-url') as HTMLInputElement;
      feeRelayConfig = { url: urlInput?.value.trim() || 'http://localhost:3002' };
    }

    client = await Midday.Client.create({
      networkConfig,
      wallet,
      privateStateProvider: Midday.PrivateState.indexedDBPrivateStateProvider({
        privateStateStoreName: 'midnight-dapp-counter',
      }),
      ...(feeRelayConfig ? { feeRelay: feeRelayConfig } : {}),
    });

    addressDiv.textContent = `Connected: ${wallet.coinPublicKey.slice(0, 16)}...`;
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

    const loaded = await client.loadContract({
      module: CounterContract,
      zkConfig: new Midday.ZkConfig.HttpZkConfigProvider(zkConfigUrl),
      privateStateId: 'midnight-dapp-counter',
    });

    updateStatus('Deploying contract...');
    contract = await loaded.deploy();

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
    const result = await contract.actions.increment();
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
  if (!wallet) {
    updateStatus('Not connected - connect wallet first', true);
    return;
  }

  try {
    updateStatus('Fetching balances...');

    const balance = await wallet.getBalance();

    const shieldedKeys = Object.keys(balance.shielded);
    const unshieldedKeys = Object.keys(balance.unshielded);
    const shieldedNative = balance.shielded[''] ?? (shieldedKeys.length > 0 ? balance.shielded[shieldedKeys[0]] : 0n);
    const unshieldedNative = balance.unshielded[''] ?? (unshieldedKeys.length > 0 ? balance.unshielded[unshieldedKeys[0]] : 0n);

    const balanceInfo = document.getElementById('balance-info');
    const shieldedEl = document.getElementById('shielded-balance');
    const unshieldedEl = document.getElementById('unshielded-balance');
    const dustBalanceEl = document.getElementById('dust-balance');
    const dustCapEl = document.getElementById('dust-cap');

    if (balanceInfo) balanceInfo.style.display = 'block';
    if (shieldedEl) shieldedEl.textContent = formatBalance(shieldedNative);
    if (unshieldedEl) unshieldedEl.textContent = formatBalance(unshieldedNative);
    if (dustBalanceEl) dustBalanceEl.textContent = formatBalance(balance.dust.balance);
    if (dustCapEl) dustCapEl.textContent = formatBalance(balance.dust.cap);

    updateStatus('Balances updated');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    updateStatus(`Failed to get balances: ${message}`, true);
  }
}

// Fund wallet via faucet
async function fundWallet() {
  if (!wallet) {
    updateStatus('Not connected - connect wallet first', true);
    return;
  }

  try {
    updateStatus('Requesting funds from faucet...');

    const response = await fetch('http://localhost:3001/faucet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coinPublicKey: wallet.coinPublicKey,
        encryptionPublicKey: wallet.encryptionPublicKey,
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

// Show/hide fee relay URL input when checkbox is toggled
const feeRelayCheckbox = document.getElementById('fee-relay-checkbox') as HTMLInputElement;
const feeRelayUrlInput = document.getElementById('fee-relay-url') as HTMLInputElement;
function updateFeeRelayUI() {
  feeRelayUrlInput.style.display = feeRelayCheckbox.checked ? 'block' : 'none';
}
feeRelayCheckbox.addEventListener('change', updateFeeRelayUI);
updateFeeRelayUI();

// Initial status
updateStatus('Select network and click "Connect Wallet" to begin');
