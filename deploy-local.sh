#!/bin/bash
set -e

echo "🚀 Co-Op Protocol Local Deployment & Demo Setup"
echo "================================================"
echo ""

# Check prerequisites
if ! command -v forge &> /dev/null; then
    echo "❌ Foundry not found. Install from https://book.foundry.sh/getting-started/installation"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi

# Check if anvil is running
if ! nc -z 127.0.0.1 8545 2>/dev/null; then
    echo "⚠️  Anvil is not running on http://127.0.0.1:8545"
    echo "   Start it in another terminal with: anvil"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Use default test account private key (Anvil account 0)
PRIVATE_KEY=${PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb476cadeee4c811dced9f59c1d8b}
RPC_URL=${RPC_URL:-http://127.0.0.1:8545}

echo "📝 Configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Using test account 0"
echo ""

# Deploy contracts
echo "1️⃣  Deploying contracts..."
DEPLOY_OUTPUT=$(cd contracts && PRIVATE_KEY=$PRIVATE_KEY forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract addresses from output
VAULT_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=CoOpVault: )0x[0-9a-fA-F]{40}' | head -1)
REGISTRY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=AttestationRegistry: )0x[0-9a-fA-F]{40}' | head -1)

if [ -z "$VAULT_ADDR" ] || [ -z "$REGISTRY_ADDR" ]; then
    echo "❌ Failed to extract contract addresses"
    exit 1
fi

echo ""
echo "✅ Contracts deployed:"
echo "   CoOpVault: $VAULT_ADDR"
echo "   AttestationRegistry: $REGISTRY_ADDR"
echo ""

# Export ABI & addresses
echo "2️⃣  Exporting ABIs & addresses..."
cd contracts
npx ts-node script/export-abi.ts \
    --vault "$VAULT_ADDR" \
    --registry "$REGISTRY_ADDR" \
    --chain anvil
cd ..
echo ""

# Seed demo data
echo "3️⃣  Seeding demo data..."
SEED_OUTPUT=$(cd contracts && PRIVATE_KEY=$PRIVATE_KEY forge script script/SeedDemo.s.sol --rpc-url $RPC_URL --broadcast 2>&1)
echo "$SEED_OUTPUT" | grep -E "(Created|Deposited|Minted|SEED DATA)" || echo "✅ Demo data seeded"
echo ""

# Instructions for frontend
echo "✨ Setup complete! Next steps:"
echo ""
echo "1. Start the frontend dev server:"
echo "   cd frontend && npm run dev"
echo ""
echo "2. Open http://localhost:3000 in your browser"
echo ""
echo "3. Connect your wallet with the test account:"
echo "   - Add Anvil network to MetaMask:"
echo "     • RPC: http://127.0.0.1:8545"
echo "     • Chain ID: 31337"
echo "   - Or use RainbowKit to connect"
echo ""
echo "4. Verify demo data:"
echo "   ✓ Workspace: 'IITR Hackathon Team Vault'"
echo "   ✓ Treasury: 0.5 ETH"
echo "   ✓ Expenses: 2 proposals (1 pending, 1 ready to execute)"
echo "   ✓ Attestation: 1 soulbound token"
echo ""
