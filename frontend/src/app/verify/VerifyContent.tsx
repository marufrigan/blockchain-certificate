"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import CopyButton from "@/components/CopyButton";
import Timeline from "@/components/Timeline";

interface VerifyResult {
  certificateId: string;
  isValid: boolean;
  certificate?: {
    studentName: string;
    studentId: string;
    degree: string;
    department: string;
    issueDate: string;
    status: string;
    revocationReason?: string;
    replacedByCertificateId?: string;
    previousCertificateId?: string;
    versionNumber: number;
    ipfsUrl?: string | null;
    ipfsCid?: string;
    certificateHash: string;
    issuerWallet?: string;
  };
  transactions?: { tx_hash: string; action: string }[];
  history?: { database: unknown[]; blockchain: unknown[] };
  verificationTimeMs?: number;
  verifyUrl?: string;
  ipfsDocumentNote?: string | null;
}

export default function VerifyContent() {
  const searchParams = useSearchParams();
  const [certId, setCertId] = useState(searchParams.get("id") || "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const verify = async (id?: string) => {
    const cid = (id || certId).trim();
    if (!cid) return;
    setLoading(true);
    setError("");
    try {
      const data = await api<VerifyResult>(`/api/certificates/verify/${encodeURIComponent(cid)}`);
      setResult(data);
      setCertId(cid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) verify(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const downloadReceipt = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verification-${result.certificateId}.json`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-serif text-3xl font-bold text-academic-900">Public Certificate Verification</h1>
      <p className="mt-2 text-slate-600">Enter a certificate ID to check its blockchain-verified status.</p>

      <form
        className="mt-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <input
          className="input flex-1"
          placeholder="e.g. CERT-MSU-2024-001"
          value={certId}
          onChange={(e) => setCertId(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result?.certificate && (
        <div className="mt-10 space-y-6">
          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Certificate ID</p>
                <p className="font-mono font-semibold">{result.certificateId}</p>
                <CopyButton value={result.certificateId} />
              </div>
              <StatusBadge status={result.certificate.status} />
            </div>

            <div
              className={`mt-4 rounded-lg p-4 text-center ${
                result.isValid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              }`}
            >
              <p className="text-lg font-bold">
                {result.isValid ? "✓ Valid & Active" : "✗ Not Valid for Use"}
              </p>
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Student</dt>
                <dd className="font-medium">{result.certificate.studentName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Degree</dt>
                <dd className="font-medium">{result.certificate.degree}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Issue Date</dt>
                <dd>{String(result.certificate.issueDate).slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Version</dt>
                <dd>v{result.certificate.versionNumber}</dd>
              </div>
            </dl>

            {result.certificate.revocationReason && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                Revocation reason: {result.certificate.revocationReason}
              </p>
            )}
            {result.certificate.replacedByCertificateId && (
              <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Replaced by:{" "}
                <a href={`/verify?id=${result.certificate.replacedByCertificateId}`} className="underline">
                  {result.certificate.replacedByCertificateId}
                </a>
              </p>
            )}

            {result.transactions?.[0]?.tx_hash && (
              <div className="mt-4">
                <p className="text-xs text-slate-500">Blockchain transaction</p>
                <p className="break-all font-mono text-xs">{result.transactions[0].tx_hash}</p>
                <CopyButton value={result.transactions[0].tx_hash} />
              </div>
            )}

            {result.certificate.ipfsUrl && (
              <a
                href={result.certificate.ipfsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm text-academic-600 underline"
              >
                View document on IPFS
              </a>
            )}

            {result.ipfsDocumentNote && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {result.ipfsDocumentNote}
              </p>
            )}

            {!result.certificate.ipfsUrl && result.certificate.ipfsCid && (
              <p className="mt-2 text-xs text-slate-600">
                On-chain IPFS CID (reference only):{" "}
                <span className="font-mono break-all">{result.certificate.ipfsCid}</span>{" "}
                <CopyButton value={result.certificate.ipfsCid} label="Copy CID" />
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={downloadReceipt} className="btn-secondary">
                Download verification receipt
              </button>
              <a href={`/certificates/${result.certificateId}`} className="btn-secondary">
                Full details
              </a>
            </div>
          </div>

          {result.verifyUrl && (
            <div className="card flex flex-col items-center">
              <p className="mb-4 text-sm font-medium text-slate-600">QR Code for verification URL</p>
              <QRCodeSVG value={result.verifyUrl} size={160} />
            </div>
          )}

          <div className="card">
            <h2 className="font-semibold text-academic-800">Version history</h2>
            <div className="mt-4">
              <Timeline
                items={[
                  ...(result.history?.blockchain as { certificateId: string; status: string; versionNumber: number }[] || []).map(
                    (h) => ({
                      certificateId: h.certificateId,
                      status: h.status,
                      versionNumber: h.versionNumber,
                      action: `Version ${h.versionNumber}`,
                    })
                  ),
                  ...(result.history?.database as { action: string; created_at: string; reason?: string }[] || []).map(
                    (h) => ({
                      action: h.action,
                      created_at: h.created_at,
                      reason: h.reason,
                    })
                  ),
                ]}
              />
            </div>
            {result.verificationTimeMs != null && (
              <p className="mt-4 text-xs text-slate-500">
                Verification completed in {result.verificationTimeMs}ms
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
