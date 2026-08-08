<div align="center">

# Co-Op Protocol 🤝⚙️

### Self-Healing Treasury & Proof-of-Work Attestation Engine

[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Built%20with-Foundry-black?style=flat-square&logo=ethereum)](https://book.getfoundry.sh/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Wagmi](https://img.shields.io/badge/Wagmi-v2-1E1E1E?style=flat-square&logo=ethereum)](https://wagmi.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

**Track:** Decentralised Coordination Layers &nbsp;·&nbsp; **Hackathon:** Blockchain Society IITR

</div>

---

## Executive Summary

Traditional multi-sig vaults have two blind spots. First, they **stall on offline signers** — a payout sits pending indefinitely if even one required co-signer is unreachable, with no mechanism to route around it. Second, once funds *do* move, there is **zero on-chain proof that the work behind the payout was ever done** — treasury disbursement and task verification live in completely disconnected systems (a Discord approval, a spreadsheet, a Slack "looks good").

**Co-Op Protocol** closes both gaps. Workspaces pool funds into an isolated on-chain treasury, expenses execute the moment a configurable member threshold approves them — no single offline signer can block the vault — and every completed task is minted as a non-transferable **attestation NFT** bound to the contributor and the workspace. The result is a coordination layer where *financial settlement* and *proof of work* are the same on-chain event, not two systems trusting each other after the fact.

## Key Features

- **`CoOpVault.sol` — Threshold-Gated Treasury**
  Members create workspaces with a configurable approval threshold; deposits are tracked per-workspace so treasuries never commingle. Expenses auto-execute the instant enough members approve, or can be settled after the fact once funds arrive.

- **`AttestationRegistry.sol` — Soulbound Task Tokens**
  A non-transferable ERC-721 registry where `approve` and `setApprovalForAll` are hard-disabled at the contract level. Each `(workspace, contributor, taskHash)` triple is unique while live, giving every completed task a permanent, forgery-resistant on-chain record.

- **Security by Construction**
  Checks-effects-interactions ordering, `nonReentrant` guards on every value-transferring entrypoint, and strict per-workspace balance isolation — verified by an invariant that `address(this).balance` always equals the sum of every workspace's treasury.

- **Dark-Theme Web3 Frontend**
  A Next.js 16 App Router interface (TypeScript, Tailwind, Wagmi v2) for creating workspaces, voting on expenses, and viewing minted attestations — wallet-connected end to end.

## System Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌───────────────────┐
│  Workspace   │─────▶│  Expense Request  │─────▶│ Threshold Voting   │
│  (members,   │      │ (recipient,       │      │ (approveExpense    │
│  threshold)  │      │  amount, hash)     │      │  per member)       │
└──────┬───────┘      └──────────────────┘      └─────────┬──────────┘
       │                                                    │
       │ deposit()                                 threshold met
       ▼                                                    ▼
┌──────────────┐                                  ┌────────────────────┐
│   Treasury    │◀────────────settles from─────────│  CoOpVault.sol     │
│ (per-workspace│                                  │  executeExpense()  │
│   balance)    │                                  │  nonReentrant      │
└──────────────┘                                  └─────────┬──────────┘
                                                              │
                                                     payout confirmed
                                                              ▼
                                                  ┌─────────────────────────┐
                                                  │ AttestationRegistry.sol │
                                                  │  mintAttestation()      │
                                                  │  soulbound ERC-721      │
                                                  └─────────────────────────┘
```

## Testing & Security

Full Foundry suite — **78 passing unit/fuzz tests, 0 failures**:

| Suite                      | Passed | Failed | Skipped |
|-----------------------------|:------:|:------:|:-------:|
| `CoOpVaultTest`              | 56     | 0      | 0       |
| `AttestationRegistryTest`    | 22     | 0      | 0       |
| **Total**                    | **78** | **0**  | **0**   |

- **Invariant checks** — `address(this).balance == totalTreasury` holds across every deposit/payout path; the vault has no `receive`/`fallback`, so funds can only enter through `deposit()`.
- **Reentrancy protection** — `approveExpense` and `executeExpense` are `nonReentrant` and follow checks-effects-interactions; covered by `test_ExecuteExpense_BlocksReentrantRecipient` and `test_ExecuteExpense_RevertsWhenRecipientRejectsFunds`.
- **Fuzz coverage** — `testFuzz_MintAttestation_AssignsSequentialIds` runs 256 randomized cases to confirm token ID monotonicity.
- **Soulbound enforcement** — transfer, `approve`, and `setApprovalForAll` all revert on `AttestationRegistry`, verified directly in the test suite.

Run it yourself:

```bash
cd contracts
forge test -vv
```

## Quickstart

**Smart Contracts**

```bash
cd contracts
forge test
```

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` and connect a Web3 wallet to interact with deployed contracts.

### One-Command Local Demo

```bash
./deploy-local.sh
```

Deploys `CoOpVault` and `AttestationRegistry` to Anvil, exports ABIs/addresses to `frontend/src/config/contracts.json`, and seeds a demo workspace with expenses and attestations. See [DEPLOYMENT.md](./DEPLOYMENT.md) for Sepolia, Base Sepolia, and Arbitrum Sepolia instructions.
