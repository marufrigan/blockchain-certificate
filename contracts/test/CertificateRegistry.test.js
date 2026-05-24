const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("CertificateRegistry", function () {
  async function deployFixture() {
    const [superAdmin, university, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await Registry.deploy(superAdmin.address);
    await registry.waitForDeployment();
    await registry.connect(superAdmin).registerUniversity(university.address);
    return { registry, superAdmin, university, other };
  }

  const sampleCert = {
    certificateId: "CERT-2024-001",
    studentName: "Alice Johnson",
    studentId: "STU-1001",
    degree: "BSc Computer Science",
    department: "Engineering",
    issueDate: Math.floor(Date.now() / 1000),
    certificateHash: ethers.id("pdf-hash-alice"),
    ipfsCid: "QmSampleCid001",
    previousCertificateId: "",
    versionNumber: 1,
  };

  it("registers university and issues certificate", async function () {
    const { registry, university } = await loadFixture(deployFixture);
    await expect(
      registry.connect(university).issueCertificate(
        sampleCert.certificateId,
        sampleCert.studentName,
        sampleCert.studentId,
        sampleCert.degree,
        sampleCert.department,
        sampleCert.issueDate,
        sampleCert.certificateHash,
        sampleCert.ipfsCid,
        sampleCert.previousCertificateId,
        sampleCert.versionNumber
      )
    ).to.emit(registry, "CertificateIssued");

    const [exists, isValid, status] = await registry.verifyCertificate(sampleCert.certificateId);
    expect(exists).to.equal(true);
    expect(isValid).to.equal(true);
    expect(status).to.equal(0); // ACTIVE
  });

  it("prevents duplicate certificate IDs", async function () {
    const { registry, university } = await loadFixture(deployFixture);
    await registry.connect(university).issueCertificate(
      sampleCert.certificateId,
      sampleCert.studentName,
      sampleCert.studentId,
      sampleCert.degree,
      sampleCert.department,
      sampleCert.issueDate,
      sampleCert.certificateHash,
      sampleCert.ipfsCid,
      "",
      1
    );
    await expect(
      registry.connect(university).issueCertificate(
        sampleCert.certificateId,
        "Bob",
        "STU-2",
        "BA",
        "Arts",
        sampleCert.issueDate,
        sampleCert.certificateHash,
        "QmOther",
        "",
        1
      )
    ).to.be.reverted;
  });

  it("revokes active certificate", async function () {
    const { registry, university } = await loadFixture(deployFixture);
    await registry.connect(university).issueCertificate(
      sampleCert.certificateId,
      sampleCert.studentName,
      sampleCert.studentId,
      sampleCert.degree,
      sampleCert.department,
      sampleCert.issueDate,
      sampleCert.certificateHash,
      sampleCert.ipfsCid,
      "",
      1
    );
    await registry.connect(university).revokeCertificate(sampleCert.certificateId, "Academic misconduct");
    const [, isValid, status, , , , reason] = await registry.verifyCertificate(sampleCert.certificateId);
    expect(isValid).to.equal(false);
    expect(status).to.equal(1); // REVOKED
    expect(reason).to.equal("Academic misconduct");
  });

  it("replaces certificate and links versions", async function () {
    const { registry, university } = await loadFixture(deployFixture);
    await registry.connect(university).issueCertificate(
      sampleCert.certificateId,
      sampleCert.studentName,
      sampleCert.studentId,
      sampleCert.degree,
      sampleCert.department,
      sampleCert.issueDate,
      sampleCert.certificateHash,
      sampleCert.ipfsCid,
      "",
      1
    );

    const newId = "CERT-2024-001-v2";
    const newHash = ethers.id("pdf-hash-alice-v2");
    await registry.connect(university).replaceCertificate(
      sampleCert.certificateId,
      newId,
      sampleCert.studentName,
      sampleCert.studentId,
      "BSc Computer Science (Honours)",
      sampleCert.department,
      sampleCert.issueDate,
      newHash,
      "QmSampleCid002"
    );

    const [, oldValid, oldStatus, , , , , replacedBy] = await registry.verifyCertificate(sampleCert.certificateId);
    expect(oldValid).to.equal(false);
    expect(oldStatus).to.equal(2); // REPLACED
    expect(replacedBy).to.equal(newId);

    const [, newValid, , , degree] = await registry.verifyCertificate(newId);
    expect(newValid).to.equal(true);
    expect(degree).to.equal("BSc Computer Science (Honours)");

    const [historyIds] = await registry.getCertificateHistory(newId);
    expect(historyIds.length).to.equal(2);
    expect(historyIds[0]).to.equal(sampleCert.certificateId);
    expect(historyIds[1]).to.equal(newId);
  });

  it("cannot revoke replaced certificate", async function () {
    const { registry, university } = await loadFixture(deployFixture);
    await registry.connect(university).issueCertificate(
      sampleCert.certificateId,
      sampleCert.studentName,
      sampleCert.studentId,
      sampleCert.degree,
      sampleCert.department,
      sampleCert.issueDate,
      sampleCert.certificateHash,
      sampleCert.ipfsCid,
      "",
      1
    );
    await registry.connect(university).replaceCertificate(
      sampleCert.certificateId,
      "CERT-2024-001-v2",
      sampleCert.studentName,
      sampleCert.studentId,
      sampleCert.degree,
      sampleCert.department,
      sampleCert.issueDate,
      sampleCert.certificateHash,
      "QmNew",
    );
    await expect(
      registry.connect(university).revokeCertificate(sampleCert.certificateId, "Late revoke")
    ).to.be.reverted;
  });
});
