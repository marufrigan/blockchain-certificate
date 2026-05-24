"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { connectWallet, switchToChain } from "@/lib/web3";

interface Props {
  requiredChainId?: number;
  onConnected?: (address: string) => void;
}

const defaultChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");

export default function WalletConnect({ requiredChainId = defaultChainId, onConnected }: Props) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    setConnecting(true);
    try {
      await switchToChain(requiredChainId);
      const { address: addr } = await connectWallet();
      setAddress(addr);
      onConnected?.(addr);
      toast.success("Wallet connected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono text-xs text-emerald-800">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      ) : (
        <button type="button" onClick={connect} disabled={connecting} className="btn-secondary">
          {connecting ? "Connecting..." : "Connect MetaMask"}
        </button>
      )}
    </div>
  );
}
