#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing dependencies..."
npm install
cd contracts && npm install && npm run compile && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure DATABASE_URL, JWT_SECRET, Pinata keys"
echo "2. createdb trustcert && npm run db:migrate && npm run db:seed"
echo "3. Start Hardhat node: cd contracts && npx hardhat node"
echo "4. Deploy: cd contracts && npm run deploy:local"
echo "5. Set CONTRACT_ADDRESS in .env from backend/src/config/deployment.json"
echo "6. Register university wallet on-chain via Super Admin MetaMask"
echo "7. npm run dev:backend & npm run dev:frontend"
