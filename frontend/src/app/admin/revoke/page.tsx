"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import AdminGuard from "@/components/AdminGuard";
import WalletConnect from "@/components/WalletConnect";
import TxStatus from "@/components/TxStatus";
import { useAuth } from "@/context/AuthContext";
import { useCertificateTx } from "@/hooks/useCertificateTx";

export default function RevokeCertificatePage() {
  const { token } = useAuth();
  const { revoke, txStatus, txHash } = useCertificateTx(token);
  const [wallet, setWallet] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return toast.error("Connect wallet first");
    try {
      await revoke(certificateId, reason, wallet);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed");
    }
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="font-serif text-3xl font-bold text-red-800">Revoke Certificate</h1>
        <WalletConnect onConnected={setWallet} />
        <form onSubmit={handleSubmit} className="card mt-8 space-y-4">
          <div>
            <label className="label">Certificate ID</label>
            <input className="input" value={certificateId} onChange={(e) => setCertificateId(e.target.value)} required />
          </div>
          <div>
            <label className="label">Revocation reason</label>
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <TxStatus status={txStatus} txHash={txHash} />
          <button type="submit" className="btn-primary w-full bg-red-600 hover:bg-red-500">
            Revoke on Blockchain
          </button>
        </form>
      </div>
    </AdminGuard>
  );
}
