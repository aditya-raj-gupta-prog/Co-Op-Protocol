# Co-Op Protocol Deployment & Demo Setup

This guide covers deploying the smart contracts and seeding demo data for local testing and Ethereum testnets.

## Prerequisites

- Foundry installed (`forge`, `anvil`, `cast`)
- Node.js 20+ and npm
- A funded wallet for testnet deployments

## Local Development (Anvil)

### 1. Start Anvil

```bash
anvil
```

This runs a local EVM at `http://127.0.0.1:8545` with chain ID `31337` and pre-funded test accounts.

### 2. Deploy Contracts

```bash
cd contracts
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

The script will output:
```
=== DEPLOYMENT COMPLETE ===
CoOpVault: 0x5FbDB2315678afccB33F46c0c4A8f22b1e6bd5ef
AttestationRegistry: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 3. Export ABI & Addresses to Frontend

```bash
npx ts-node contracts/script/export-abi.ts \
  --vault 0x5FbDB2315678afccB33F46c0c4A8f22b1e6bd5ef \
  --registry 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
  --chain anvil
```

This updates `frontend/src/config/contracts.json` with the deployed addresses and compiled ABIs.

### 4. Seed Demo Data

```bash
PRIVATE_KEY=0x... forge script script/SeedDemo.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

This creates:
- **Workspace**: "IITR Hackathon Team Vault" (2/3 approval threshold)
  - **Treasury**: 0.5 ETH
  - **Members**: alice, bob (plus deployer)
- **Expenses**:
  - Graphics & UI Design ($0.05 ETH) — 1/2 approvals (pending)
  - IPFS Hosting Fee ($0.02 ETH) — 2/2 approvals (ready to execute)
- **Attestation**: "Smart Contract Architecture Completion" (soulbound token)

### 5. Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000/workspaces` in your browser.

### 6. Connect Wallet

1. Add Anvil network to MetaMask or use RainbowKit:
   - Network Name: Anvil Local
   - RPC: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: ETH

2. Import test account into your wallet:
   - Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb476cadeee4c811dced9f59c1d8b` (Anvil account 0)

3. Connect via RainbowKit in the app.

### 7. Verify Demo State

Navigate the frontend and verify:
- ✓ Workspace displays "IITR Hackathon Team Vault"
- ✓ Treasury balance shows 0.5 ETH
- ✓ Member list includes alice and bob
- ✓ Expense proposals load with correct approval counts
- ✓ Attestations gallery shows the minted token

## Testnet Deployment

### Sepolia

```bash
# Set up your private key and export it securely:
export PRIVATE_KEY=0x...

# Deploy
cd contracts
forge script script/Deploy.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_INFURA_KEY --broadcast

# Export addresses
npx ts-node script/export-abi.ts \
  --vault <vault-address> \
  --registry <registry-address> \
  --chain sepolia
```

### Base Sepolia & Arbitrum Sepolia

Follow the same flow as Sepolia, replacing the RPC endpoint and `--chain` flag.

## Automated Deployment Helper

For convenience, use the provided shell/bash scripts (coming soon):

```bash
# One-liner to deploy + seed + export
./deploy-local.sh
```

## Troubleshooting

**Issue**: Contracts not found at zero address in frontend
- **Fix**: Ensure `export-abi.ts` ran successfully and check `frontend/src/config/contracts.json`

**Issue**: Wallet won't connect
- **Fix**: Ensure Anvil is running and the network is added to your wallet with correct chain ID (31337)

**Issue**: Seed script fails
- **Fix**: Confirm contracts are deployed first by checking addresses in contracts.json

## Security Notes

- Test account private keys in this guide are public. **Never use in production.**
- Environment variables containing private keys should be managed securely (use `.env.local` with git ignored).
- For mainnet deployment, use hardware wallets or key management services.
