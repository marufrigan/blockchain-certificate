import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { getConfigDir } from "../lib/config-path.js";

const configDir = getConfigDir();
const abi = JSON.parse(fs.readFileSync(path.join(configDir, "contractAbi.json"), "utf8"));
let deployment = JSON.parse(fs.readFileSync(path.join(configDir, "deployment.json"), "utf8"));

const STATUS_MAP = ["ACTIVE", "REVOKED", "REPLACED", "SUPERSEDED"];
const RPC_TIMEOUT_MS = Number(process.env.RPC_TIMEOUT_MS || 5000);

function withRpcTimeout(promise, label = "Blockchain RPC") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `${label} timed out after ${RPC_TIMEOUT_MS}ms. Start Hardhat: npm run chain:local`
            )
          ),
        RPC_TIMEOUT_MS
      );
    }),
  ]);
}

export function reloadDeployment() {
  deployment = JSON.parse(fs.readFileSync(path.join(getConfigDir(), "deployment.json"), "utf8"));
}

export function getProvider() {
  const rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545";
  const chainId = getChainId();
  return new ethers.JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true });
}

export function getContract(signerOrProvider) {
  reloadDeployment();
  const address = process.env.CONTRACT_ADDRESS || deployment.contractAddress;
  if (!address || address === ethers.ZeroAddress) {
    throw new Error("Contract address not configured. Deploy contract and set CONTRACT_ADDRESS.");
  }
  return new ethers.Contract(address, abi, signerOrProvider);
}

export function getReadContract() {
  return getContract(getProvider());
}

export async function waitForTransaction(txHash, confirmations = 1) {
  const provider = getProvider();
  const start = Date.now();
  const receipt = await provider.waitForTransaction(txHash, confirmations);
  const confirmationTimeMs = Date.now() - start;
  return {
    receipt,
    confirmationTimeMs,
    gasUsed: receipt?.gasUsed?.toString(),
    gasPrice: receipt?.gasPrice?.toString(),
    blockNumber: receipt?.blockNumber,
    status: receipt?.status === 1 ? "CONFIRMED" : "FAILED",
  };
}

export async function verifyOnChain(certificateId) {
  const start = Date.now();
  const contract = getReadContract();
  const result = await withRpcTimeout(
    contract.verifyCertificate(certificateId),
    "verifyCertificate"
  );
  const responseTimeMs = Date.now() - start;

  const [
    exists,
    isValid,
    status,
    studentName,
    degree,
    issueDate,
    revocationReason,
    replacedByCertificateId,
    previousCertificateId,
    versionNumber,
    certificateHash,
    ipfsCid,
  ] = result;

  return {
    exists,
    isValid,
    status: STATUS_MAP[Number(status)] || "UNKNOWN",
    studentName,
    degree,
    issueDate: Number(issueDate),
    revocationReason,
    replacedByCertificateId,
    previousCertificateId,
    versionNumber: Number(versionNumber),
    certificateHash,
    ipfsCid,
    responseTimeMs,
  };
}

export async function getOnChainHistory(certificateId) {
  const contract = getReadContract();
  const [historyIds, historyCerts] = await withRpcTimeout(
    contract.getCertificateHistory(certificateId),
    "getCertificateHistory"
  );
  return historyIds.map((id, i) => {
    const c = historyCerts[i];
    return {
      certificateId: id,
      studentName: c.studentName,
      studentId: c.studentId,
      degree: c.degree,
      department: c.department,
      issueDate: Number(c.issueDate),
      issuerWallet: c.issuerWallet,
      certificateHash: c.certificateHash,
      ipfsCid: c.ipfsCid,
      status: STATUS_MAP[Number(c.status)],
      revocationReason: c.revocationReason,
      previousCertificateId: c.previousCertificateId,
      replacedByCertificateId: c.replacedByCertificateId,
      versionNumber: Number(c.versionNumber),
      revokedAt: Number(c.revokedAt),
      replacedAt: Number(c.replacedAt),
    };
  });
}

export function hashCertificateContent(buffer) {
  return ethers.keccak256(buffer);
}

export function getContractAddress() {
  reloadDeployment();
  return process.env.CONTRACT_ADDRESS || deployment.contractAddress;
}

export function getChainId() {
  return Number(process.env.CHAIN_ID || deployment.chainId || 80002);
}
