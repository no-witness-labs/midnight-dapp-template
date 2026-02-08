# Midnight dApp Template

A starter template for building dApps on [Midnight Network](https://midnight.network). Uses a counter contract as an example with Lace browser wallet integration, local devnet support, and optional fee relay + faucet.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/) (for local devnet)
- [Lace wallet](https://www.lace.io/) browser extension
- [Compact compiler](https://docs.midnight.network/) (`compactc`) — only needed if modifying contracts

## Quick Start

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
└── devnet/                 # Local devnet orchestration
    ├── package.json        # Standalone package
    └── src/
        ├── start.ts        # Start cluster + faucet + fee relay
        └── stop.ts         # Stop and remove all containers
```

Each directory (`app/`, `devnet/`) is a standalone package with its own `package.json` and `pnpm install`.

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

By default, the **fee relay** is enabled. This means the devnet genesis wallet pays transaction fees (dust) on behalf of users, so they don't need dust to interact with contracts.

Uncheck "Use Fee Relay" before connecting to pay fees with your own wallet's dust.

## Networks

- **Local Devnet** — fully local, requires Docker, free to use
- **Preview (Testnet)** — public testnet, requires Lace configured for Preview

## Built With

- [Midday SDK](https://github.com/no-witness-labs/midday-sdk) — developer-friendly SDK for Midnight Network
- [Vite](https://vitejs.dev/) — frontend tooling
- [Lace Wallet](https://www.lace.io/) — browser wallet for Midnight
