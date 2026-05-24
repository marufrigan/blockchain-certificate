"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import AdminGuard from "@/components/AdminGuard";
import WalletConnect from "@/components/WalletConnect";
import TxStatus from "@/components/TxStatus";
import { useAuth } from "@/context/AuthContext";
import { useCertificateTx } from "@/hooks/useCertificateTx";

export default function IssueCertificatePage() {
  const { token } = useAuth();
  const { issue, txStatus, txHash } = useCertificateTx(token);
  const [wallet, setWallet] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!wallet) {
      toast.error("Connect MetaMask first");
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("walletAddress", wallet);
    try {
      await issue(fd, wallet);
      form.reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Issue failed");
    }
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-3xl font-bold">Issue Certificate</h1>
        <div className="mt-4">
          <WalletConnect onConnected={setWallet} />
        </div>

        <form onSubmit={handleSubmit} className="card mt-8 space-y-4">
          <div>
            <label className="label">Certificate ID</label>
            <input name="certificateId" className="input" defaultValue="CERT-MSU-2024-001" required />
          </div>
          <div>
            <label className="label">Student Name</label>
            <input name="studentName" className="input" defaultValue="Alice Johnson" required />
          </div>
          <div>
            <label className="label">Student ID</label>
            <input name="studentId" className="input" defaultValue="STU-2024-1001" required />
          </div>
          <div>
            <label className="label">Degree</label>
            <input name="degree" className="input" defaultValue="BSc Computer Science" required />
          </div>
          <div>
            <label className="label">Department</label>
            <input name="department" className="input" defaultValue="School of Engineering" required />
          </div>
          <div>
            <label className="label">Issue Date</label>
            <input name="issueDate" type="date" className="input" defaultValue="2024-06-15" required />
          </div>
          <div>
            <label className="label">Certificate PDF (optional)</label>
            <input name="certificateFile" type="file" accept=".pdf" className="input" />
          </div>
          <TxStatus status={txStatus} txHash={txHash} />
          <button type="submit" disabled={!wallet || txStatus === "signing"} className="btn-primary w-full">
            Issue on Blockchain
          </button>
        </form>
      </div>
    </AdminGuard>
  );
}
