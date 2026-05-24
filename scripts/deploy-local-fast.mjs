/**
 * Deploy + register university using ethers only (no Hardhat CLI — saves 3–8 min per run).
 */
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = 31337;
const HARDHAT_ACCOUNT_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function resolveDeployerKey() {
  const fromEnv = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (fromEnv) {
    try {
      new ethers.Wallet(fromEnv);
      return fromEnv;
    } catch {
      console.warn("DEPLOYER_PRIVATE_KEY in .env is invalid; using Hardhat account #0");
    }
  }
  return HARDHAT_ACCOUNT_0;
}

const DEPLOYER_KEY = resolveDeployerKey();

const artifactPath = path.join(
  ROOT,
  "contracts/artifacts/src/CertificateRegistry.sol/CertificateRegistry.json"
);
const depPath = path.join(ROOT, "backend/src/config/deployment.json");

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);

async function saveDeployment(address) {
  const deployment = {
    network: "localhost",
    chainId: CHAIN_ID,
    contractAddress: address,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(depPath), { recursive: true });
  fs.writeFileSync(depPath, JSON.stringify(deployment, null, 2));
  fs.writeFileSync(
    path.join(ROOT, "contracts/deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  return deployment;
}

async function registerUniversity(registry) {
  const registered = await registry.registeredUniversities(wallet.address);
  if (registered) {
    console.log("University already registered:", wallet.address);
    return;
  }
  const tx = await registry.registerUniversity(wallet.address);
  await tx.wait();
  console.log("Registered university admin:", wallet.address);
}

async function main() {
  if (!fs.existsSync(artifactPath)) {
    console.error("Missing compiled artifact. Run: npm run compile");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  if (fs.existsSync(depPath)) {
    const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
    if (dep.chainId === CHAIN_ID && dep.contractAddress) {
      const code = await provider.getCode(dep.contractAddress);
      if (code && code !== "0x") {
        console.log("Contract already on chain:", dep.contractAddress);
        const registry = new ethers.Contract(dep.contractAddress, artifact.abi, wallet);
        await registerUniversity(registry);
        return;
      }
    }
  }

  console.log("Deploying CertificateRegistry with", wallet.address);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const registry = await factory.deploy(wallet.address);
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  await saveDeployment(address);
  console.log("CertificateRegistry deployed to:", address);
  await registerUniversity(registry);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
