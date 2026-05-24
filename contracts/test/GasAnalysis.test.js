/**
 * Research gas analysis — measures gas for issue, revoke, replace, verify (view).
 * Run: npm run gas:analysis --workspace=contracts
 */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function row(action, receipt, extra = {}) {
  const gasUsed = receipt ? Number(receipt.gasUsed) : 0;
  const gasPrice = receipt?.gasPrice ? BigInt(receipt.gasPrice) : 0n;
  const costWei = receipt ? BigInt(gasUsed) * gasPrice : 0n;
  return {
    action,
    gasUsed,
    gasPriceWei: gasPrice.toString(),
    transactionCostWei: costWei.toString(),
    transactionCostEth: ethers.formatEther(costWei),
    blockNumber: receipt?.blockNumber ?? null,
    ...extra,
  };
}

describe("Gas analysis (research)", function () {
  this.timeout(120000);

  it("captures gas for full lifecycle", async function () {
    const [superAdmin, university] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy(superAdmin.address);
    await registry.waitForDeployment();

    const results = [];

    let tx = await registry.connect(superAdmin).registerUniversity(university.address);
    let receipt = await tx.wait();
    results.push(row("REGISTER_UNIVERSITY", receipt));

    const issueDate = Math.floor(Date.now() / 1000);
    const hash1 = ethers.id("gas-test-cert-v1");
    tx = await registry.connect(university).issueCertificate(
      "CERT-GAS-001",
      "Test Student",
      "STU-GAS-1",
      "BSc Test",
      "Engineering",
      issueDate,
      hash1,
      "QmGasTest001",
      "",
      1
    );
    receipt = await tx.wait();
    results.push(row("ISSUE", receipt, { certificateId: "CERT-GAS-001" }));

    const verifyStart = Date.now();
    await registry.verifyCertificate("CERT-GAS-001");
    const verifyMs = Date.now() - verifyStart;
    results.push({
      action: "VERIFY_VIEW",
      gasUsed: 0,
      note: "view call — no on-chain gas",
      verificationResponseTimeMs: verifyMs,
    });

    await registry.connect(university).issueCertificate(
      "CERT-GAS-002",
      "Test Student",
      "STU-GAS-2",
      "BSc Test",
      "Engineering",
      issueDate,
      ethers.id("gas-test-cert-v2"),
      "QmGasTest002",
      "",
      1
    );
    tx = await registry.connect(university).revokeCertificate("CERT-GAS-002", "Research demo revocation");
    receipt = await tx.wait();
    results.push(row("REVOKE", receipt, { certificateId: "CERT-GAS-002" }));

    await registry.connect(university).issueCertificate(
      "CERT-GAS-003",
      "Test Student",
      "STU-GAS-3",
      "BSc Test",
      "Engineering",
      issueDate,
      ethers.id("gas-test-cert-v3"),
      "QmGasTest003",
      "",
      1
    );
    tx = await registry.connect(university).replaceCertificate(
      "CERT-GAS-003",
      "CERT-GAS-003-v2",
      "Test Student",
      "STU-GAS-3",
      "BSc Test (Honours)",
      "Engineering",
      issueDate,
      ethers.id("gas-test-cert-v3b"),
      "QmGasTest003b"
    );
    receipt = await tx.wait();
    results.push(row("REPLACE", receipt, {
      oldCertificateId: "CERT-GAS-003",
      newCertificateId: "CERT-GAS-003-v2",
    }));

    const summary = {
      network: "hardhat",
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      measuredAt: new Date().toISOString(),
      operations: results,
      totals: {
        issueRevokeReplaceGas: results
          .filter((r) => ["ISSUE", "REVOKE", "REPLACE"].includes(r.action))
          .reduce((s, r) => s + (r.gasUsed || 0), 0),
      },
    };

    const outDir = path.join(__dirname, "../../docs/metrics");
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `gas-analysis-${stamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

    const csvHeaders = [
      "action",
      "gasUsed",
      "gasPriceWei",
      "transactionCostWei",
      "transactionCostEth",
      "verificationResponseTimeMs",
      "certificateId",
    ];
    const csvRows = results.map((r) =>
      csvHeaders.map((h) => JSON.stringify(r[h] ?? "")).join(",")
    );
    const csvPath = path.join(outDir, `gas-analysis-${stamp}.csv`);
    fs.writeFileSync(csvPath, [csvHeaders.join(","), ...csvRows].join("\n"));

    console.log("\n=== Gas Analysis Summary ===");
    results.forEach((r) => {
      if (r.action === "VERIFY_VIEW") {
        console.log(`${r.action}: ${r.verificationResponseTimeMs}ms (off-chain read)`);
      } else {
        console.log(`${r.action}: gasUsed=${r.gasUsed} costEth=${r.transactionCostEth}`);
      }
    });
    console.log(`\nExported: ${jsonPath}`);
    console.log(`Exported: ${csvPath}\n`);

    expect(results.find((r) => r.action === "ISSUE").gasUsed).to.be.greaterThan(0);
    expect(results.find((r) => r.action === "REVOKE").gasUsed).to.be.greaterThan(0);
    expect(results.find((r) => r.action === "REPLACE").gasUsed).to.be.greaterThan(0);
  });
});
