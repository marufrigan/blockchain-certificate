"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import AdminGuard from "@/components/AdminGuard";
import WalletConnect from "@/components/WalletConnect";
import TxStatus from "@/components/TxStatus";
import { useAuth } from "@/context/AuthContext";
import { useCertificateTx } from "@/hooks/useCertificateTx";

export default function ReplaceCertificatePage() {
  const { token } = useAuth();
  const { replace, txStatus, txHash } = useCertificateTx(token);
  const [wallet, setWallet] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wallet) return toast.error("Connect wallet first");
    const fd = new FormData(e.currentTarget);
    fd.set("walletAddress", wallet);
    try {
      await replace(fd, wallet);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replace failed");
    }
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-3xl font-bold text-amber-800">Replace Certificate</h1>
        <WalletConnect onConnected={setWallet} />
        <form onSubmit={handleSubmit} className="card mt-8 space-y-4">
          <div>
            <label className="label">Old Certificate ID</label>
            <input name="oldCertificateId" className="input" required />
          </div>
          <div>
            <label className="label">New Certificate ID</label>
            <input name="newCertificateId" className="input" required />
          </div>
          <div>
            <label className="label">Student Name</label>
            <input name="studentName" className="input" required />
          </div>
          <div>
            <label className="label">Student ID</label>
            <input name="studentId" className="input" required />
          </div>
          <div>
            <label className="label">Updated Degree</label>
            <input name="degree" className="input" required />
          </div>
          <div>
            <label className="label">Department</label>
            <input name="department" className="input" required />
          </div>
          <div>
            <label className="label">Issue Date</label>
            <input name="issueDate" type="date" className="input" required />
          </div>
          <div>
            <label className="label">New PDF</label>
            <input name="certificateFile" type="file" accept=".pdf" className="input" />
          </div>
          <TxStatus status={txStatus} txHash={txHash} />
          <button type="submit" className="btn-primary w-full">
            Replace on Blockchain
          </button>
        </form>
      </div>
    </AdminGuard>
  );
}
