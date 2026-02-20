# Midnight dApp Template

A starter template for building dApps on [Midnight Network](https://midnight.network). Uses a counter contract as an example with Lace browser wallet integration, local devnet support, and fee relay for testnets.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/) (for local devnet and proof server)
- [Lace wallet](https://www.lace.io/) browser extension
- [Compact compiler](https://docs.midnight.network/) (`compactc`) — only needed if modifying contracts

## Quick Start (Local Devnet)

```bash
git clone https://github.com/no-witness-labs/midnight-dapp-template.git
cd midnight-dapp-template
```

### 1. Start Local Devnet

```bash
cd devnet
pnpm install
DOCKER_HOST=unix:///var/run/docker.sock pnpm start
```

This starts a local Midnight cluster with:
- **Node** — local blockchain node
- **Indexer** — transaction indexer
- **Proof Server** — ZK proof generation
- **Faucet** — http://localhost:3001/faucet (fund wallets with test tokens)
- **Fee Relay** — http://localhost:3002 (genesis wallet pays tx fees)

Docker images for the faucet and fee relay are built automatically on first run.

### 2. Start the App

```bash
cd app
pnpm install
pnpm dev
```

Opens the Vite dev server at http://localhost:5173.

### 3. Use the App

1. Select **Local Devnet** from the network dropdown
2. Click **Connect Wallet** (Lace will prompt for approval)
3. Click **Fund Wallet** to get test tokens from the faucet
4. Click **Deploy Contract** to deploy the counter contract
5. Click **Increment** to call the contract
6. Click **Read State** to see the current counter value

### 4. Stop Devnet

```bash
cd devnet
DOCKER_HOST=unix:///var/run/docker.sock pnpm stop
```

## Testnet Deployment (Preview / Preprod)

To use the app on a public testnet, you need a **proof server** and a **fee relay** running locally.

- **Proof server** — the SDK requires a ZK proof server for circuit operations (`check` and `prove`) when building transactions. The public Lace proof servers are internal to the Lace wallet extension and not accessible from the SDK or fee relay. A local proof server provides this for both the browser app and the fee relay.
- **Fee relay** — the current `wallet-sdk-unshielded-wallet` v1.0.0 has a [known bug](https://github.com/midnightntwrk/example-counter/blob/main/MIGRATION_GUIDE.md) that causes "Failed to clone intent" when balancing transactions through Lace directly. The fee relay works around this by balancing transactions server-side with a patched signing flow. It also allows users without dust to submit transactions.

### 1. Start a Proof Server

```bash
docker run -p 6300:6300 bricktowers/proof-server:7.0.0
```

### 2. Start the Fee Relay

The fee relay uses a funded wallet (via 24-word mnemonic) to pay transaction fees on behalf of browser users.

```bash
cd fee-relay
pnpm install
MNEMONIC="your 24 word mnemonic phrase here" NETWORK=preprod pnpm start
```

Environment variables:
| Variable | Description | Default |
|---|---|---|
| `MNEMONIC` | 24-word BIP39 mnemonic (required) | — |
| `NETWORK` | `preview` or `preprod` | `preview` |
| `PORT` | Server port | `3002` |
| `PROOF_SERVER` | Proof server URL override | `http://localhost:6300` |

### 3. Start the App

```bash
cd app
pnpm install
pnpm dev
```

1. Select **Preview** or **Preprod** from the network dropdown
2. Ensure "Use Fee Relay" is checked with `http://localhost:3002`
3. Click **Connect Wallet** and proceed as normal

## Project Structure

```
midnight-dapp-template/
├── app/                    # Browser dApp (Vite + TypeScript)
│   ├── package.json        # Standalone package
│   ├── src/main.ts         # Wallet connection + contract interaction
│   ├── index.html          # UI
│   └── vite.config.ts      # WASM + ZK middleware config
├── contracts/counter/      # Counter contract (pre-compiled)
│   ├── simple-counter.compact  # Compact source
│   ├── contract/           # Compiled JS + type definitions
│   ├── zkir/               # ZK intermediate representations
│   └── keys/               # Prover + verifier keys
├── devnet/                 # Local devnet orchestration
│   ├── package.json        # Standalone package
│   └── src/
│       ├── start.ts        # Start cluster + faucet + fee relay
│       └── stop.ts         # Stop and remove all containers
└── fee-relay/              # Standalone fee relay for testnets
    ├── package.json        # Standalone package
    └── src/
        └── start.ts        # Mnemonic → seed, starts HTTP relay
```

Each directory (`app/`, `devnet/`, `fee-relay/`) is a standalone package with its own `package.json` and `pnpm install`.

## Modifying the Contract

1. Edit `contracts/counter/simple-counter.compact`
2. Recompile:
   ```bash
   cd contracts/counter
   compactc simple-counter.compact .
   ```
3. The compiled output goes to `contracts/counter/` (contract, zkir, keys)
4. Restart the dev server — changes are picked up automatically

## Fee Relay

On Midnight, every transaction requires a small amount of **dust** (tDUST on testnets) to pay fees. New wallets start with zero balance and can't submit transactions.

The **fee relay** solves this by using a funded wallet to pay fees on behalf of users. This way users can deploy and call contracts immediately without needing to acquire dust first.

- **Local devnet**: The devnet cluster runs a fee relay automatically using the pre-funded genesis wallet.
- **Testnets**: Use the standalone `fee-relay/` package with your own funded wallet mnemonic.

The fee relay is enabled by default. Uncheck "Use Fee Relay" before connecting to pay fees with your own wallet's dust.

## Networks

- **Local Devnet** — fully local, requires Docker, free to use
- **Preview (Testnet)** — public testnet, requires Lace configured for Preview
- **Preprod (Testnet)** — public testnet, requires Lace configured for Preprod

## Built With

- [Midday SDK](https://github.com/no-witness-labs/midday-sdk) — developer-friendly SDK for Midnight Network
- [Vite](https://vitejs.dev/) — frontend tooling
- [Lace Wallet](https://www.lace.io/) — browser wallet for Midnight
