import { BrowserProvider, Contract } from "ethers";
import { CERTIFICATE_REGISTRY_ABI } from "./contractAbi";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  return { address: accounts[0], provider, signer, chainId: Number(network.chainId) };
}

export async function switchToChain(chainId: number) {
  if (!window.ethereum) return;
  const hexChainId = "0x" + chainId.toString(16);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    if (e.code === 4902) {
      const addParams =
        chainId === 31337
          ? {
              chainId: hexChainId,
              chainName: "Hardhat Local",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["http://127.0.0.1:8545"],
            }
          : {
              chainId: hexChainId,
              chainName: "Polygon Amoy Testnet",
              nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
              rpcUrls: ["https://rpc-amoy.polygon.technology"],
              blockExplorerUrls: ["https://amoy.polygonscan.com"],
            };
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [addParams],
      });
    } else {
      throw err;
    }
  }
}

export function getContract(signerOrProvider: unknown, address: string) {
  return new Contract(address, CERTIFICATE_REGISTRY_ABI, signerOrProvider as never);
}
