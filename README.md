# co-op-protocol

Monorepo for a cooperative treasury protocol: shared workspaces fund a vault, members
approve expenses by threshold vote, and verified contributions are recorded as soulbound
attestations.

```
co-op-protocol/
├── contracts/          Foundry workspace (Solidity 0.8.28, EVM shanghai)
│   ├── src/
│   │   ├── CoOpVault.sol            Workspaces, treasury deposits, threshold-approved payouts
│   │   └── AttestationRegistry.sol  Non-transferable ERC-721 contribution attestations
│   ├── test/
│   └── lib/            forge-std, openzeppelin-contracts v5.4.0
└── frontend/           Next.js 16 App Router (TypeScript, Tailwind, ESLint)
```

## Contracts

```bash
cd contracts
forge build
forge test -vv
```

### CoOpVault

- `createWorkspace(name, initialMembers, threshold)` — the caller is always registered as a
  member, duplicates are ignored, and `threshold` must land in `[1, memberCount]`.
- `deposit(workspaceId)` — permissionless native-currency funding, tracked per workspace in
  `treasuryOf`. The contract has no `receive`/`fallback`, so `address(this).balance` always
  equals the sum of every workspace treasury.
- `createExpense(workspaceId, recipient, amount, metadataHash)` — members only;
  `metadataHash` holds the IPFS CID or URI for the receipt/invoice.
- `approveExpense(expenseId)` — one vote per member, enforced by `hasApproved`. The payout
  fires automatically once the threshold is met and the treasury can cover it.
- `executeExpense(expenseId)` — settles an already-approved request, e.g. one proposed
  before the treasury was funded.
- `rejectExpense(expenseId)` — the proposer or the contract owner can cancel a pending request.

Payouts follow checks-effects-interactions and both entrypoints are `nonReentrant`, so a
hostile recipient cannot drain a treasury.

### AttestationRegistry

Soulbound ERC-721: `_update` permits mints and burns but rejects every transfer, and
`approve`/`setApprovalForAll` revert. `mintAttestation` is restricted to the owner and
addresses allowlisted via `setAuthorizedIssuer` (intended for `CoOpVault` deployments), and
one `(workspaceId, contributor, taskHash)` triple can only be live once at a time.

## Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` and connect a Web3 wallet to interact with deployed contracts.

## Local Deployment & Demo

### Quick Start

Run contracts + seed demo data in one command:

```bash
./deploy-local.sh
```

This:
1. Deploys `CoOpVault` and `AttestationRegistry` to Anvil
2. Exports ABIs and addresses to `frontend/src/config/contracts.json`
3. Seeds demo workspace, expenses, and attestations

Then start the frontend dev server to see the demo data live.

### Manual Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step Anvil, Sepolia, Base Sepolia, and Arbitrum Sepolia deployment instructions.
