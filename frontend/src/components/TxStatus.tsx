"use client";

export default function TxStatus({
  status,
  txHash,
}: {
  status: "idle" | "preparing" | "signing" | "confirming" | "success" | "error";
  txHash?: string;
}) {
  const labels = {
    idle: "",
    preparing: "Preparing transaction...",
    signing: "Confirm in MetaMask...",
    confirming: "Waiting for blockchain confirmation...",
    success: "Transaction confirmed on-chain",
    error: "Transaction failed",
  };

  if (status === "idle") return null;

  const colors = {
    preparing: "bg-blue-50 text-blue-800",
    signing: "bg-amber-50 text-amber-800",
    confirming: "bg-blue-50 text-blue-800",
    success: "bg-emerald-50 text-emerald-800",
    error: "bg-red-50 text-red-800",
    idle: "",
  };

  return (
    <div className={`rounded-lg p-3 text-sm ${colors[status]}`}>
      <p className="font-medium">{labels[status]}</p>
      {txHash && status === "success" && (
        <p className="mt-1 break-all font-mono text-xs">
          Tx: {txHash}
        </p>
      )}
    </div>
  );
}
