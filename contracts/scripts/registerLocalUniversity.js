/**
 * Super Admin registers the local dev wallet as a university (Hardhat account #0).
 * Run after deploy: hardhat run scripts/registerLocalUniversity.js --network localhost
 */
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const depPath = path.join(__dirname, "../../backend/src/config/deployment.json");
  const dep = JSON.parse(fs.readFileSync(depPath, "utf8"));
  const Registry = await hre.ethers.getContractFactory("CertificateRegistry");
  const registry = Registry.attach(dep.contractAddress);
  await registry.registerUniversity(deployer.address);
  console.log("Registered as university admin:", deployer.address);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
