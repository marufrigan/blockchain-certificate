"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { getContract } from "@/lib/web3";
import { connectWallet } from "@/lib/web3";
import { api } from "@/lib/api";

type TxStatus = "idle" | "preparing" | "signing" | "confirming" | "success" | "error";

export function useCertificateTx(token: string | null) {
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>();

  const confirmOnBackend = async (
    certificateId: string,
    hash: string,
    action: "ISSUE" | "REVOKE" | "REPLACE",
    metadata: Record<string, unknown>
  ) => {
    setTxStatus("confirming");
    await api(
      "/api/certificates/confirm",
      {
        method: "POST",
        body: JSON.stringify({ certificateId, txHash: hash, action, metadata }),
      },
      token
    );
    setTxStatus("success");
    toast.success("Certificate synced with database");
  };

  const issue = async (formData: FormData, walletAddress: string) => {
    setTxStatus("preparing");
    const prep = await api<{
      certificateHash: string;
      ipfsCid: string;
      issueTimestamp: number;
      contractAddress: string;
      chainId: number;
      encoding: Record<string, unknown>;
    }>(
      "/api/certificates/prepare-issue",
      { method: "POST", body: formData },
      token
    );

    setTxStatus("signing");
    const { signer } = await connectWallet();
    const contract = getContract(signer, prep.contractAddress);
    const tx = await contract.issueCertificate(
      formData.get("certificateId"),
      formData.get("studentName"),
      formData.get("studentId"),
      formData.get("degree"),
      formData.get("department"),
      prep.issueTimestamp,
      prep.certificateHash,
      prep.ipfsCid,
      "",
      1
    );
    const receipt = await tx.wait();
    const hash = receipt.hash as string;
    setTxHash(hash);

    await confirmOnBackend(String(formData.get("certificateId")), hash, "ISSUE", {
      studentName: formData.get("studentName"),
      studentId: formData.get("studentId"),
      degree: formData.get("degree"),
      department: formData.get("department"),
      issueDate: formData.get("issueDate"),
      issuerWallet: walletAddress,
      certificateHash: prep.certificateHash,
      ipfsCid: prep.ipfsCid,
      versionNumber: 1,
    });
    return hash;
  };

  const revoke = async (certificateId: string, reason: string, walletAddress: string) => {
    setTxStatus("preparing");
    const prep = await api<{ contractAddress: string }>(
      "/api/certificates/prepare-revoke",
      {
        method: "POST",
        body: JSON.stringify({ certificateId, reason, walletAddress }),
      },
      token
    );

    setTxStatus("signing");
    const { signer } = await connectWallet();
    const contract = getContract(signer, prep.contractAddress);
    const tx = await contract.revokeCertificate(certificateId, reason);
    const receipt = await tx.wait();
    const hash = receipt.hash as string;
    setTxHash(hash);

    await confirmOnBackend(certificateId, hash, "REVOKE", {
      revocationReason: reason,
      issuerWallet: walletAddress,
    });
    return hash;
  };

  const replace = async (formData: FormData, walletAddress: string) => {
    setTxStatus("preparing");
    const prep = await api<{
      certificateHash: string;
      ipfsCid: string;
      issueTimestamp: number;
      versionNumber: number;
      contractAddress: string;
      encoding: { oldCertificateId: string; newCertificateId: string };
    }>(
      "/api/certificates/prepare-replace",
      { method: "POST", body: formData },
      token
    );

    setTxStatus("signing");
    const { signer } = await connectWallet();
    const contract = getContract(signer, prep.contractAddress);
    const enc = prep.encoding;
    const tx = await contract.replaceCertificate(
      enc.oldCertificateId,
      enc.newCertificateId,
      formData.get("studentName"),
      formData.get("studentId"),
      formData.get("degree"),
      formData.get("department"),
      prep.issueTimestamp,
      prep.certificateHash,
      prep.ipfsCid
    );
    const receipt = await tx.wait();
    const hash = receipt.hash as string;
    setTxHash(hash);

    await confirmOnBackend(enc.newCertificateId, hash, "REPLACE", {
      oldCertificateId: enc.oldCertificateId,
      studentName: formData.get("studentName"),
      studentId: formData.get("studentId"),
      degree: formData.get("degree"),
      department: formData.get("department"),
      issueDate: formData.get("issueDate"),
      issuerWallet: walletAddress,
      certificateHash: prep.certificateHash,
      ipfsCid: prep.ipfsCid,
      versionNumber: prep.versionNumber,
    });
    return hash;
  };

  return { issue, revoke, replace, txStatus, txHash, setTxStatus };
}
