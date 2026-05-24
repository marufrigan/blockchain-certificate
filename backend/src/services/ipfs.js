import crypto from "crypto";

/**
 * Upload file buffer to Pinata IPFS.
 * Falls back to mock CID in development when Pinata keys are absent.
 */
export async function uploadToIpfs(buffer, filename) {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !secret) {
    const mockCid = "Qm" + crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 44);
    console.warn("[IPFS] Pinata not configured — using mock CID:", mockCid);
    return { cid: mockCid, mock: true };
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: "application/pdf" });
  formData.append("file", blob, filename || "certificate.pdf");

  const metadata = JSON.stringify({ name: filename || "certificate.pdf" });
  formData.append("pinataMetadata", metadata);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata upload failed: ${err}`);
  }

  const data = await res.json();
  return { cid: data.IpfsHash, mock: false };
}

export function ipfsGatewayUrl(cid) {
  const gateway = process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
  return `${gateway}/${cid}`;
}

/** Public download link only when Pinata is configured (otherwise mock CIDs 404 on gateways). */
export function publicIpfsDocumentUrl(cid) {
  if (!cid) return null;
  const hasPinata = !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY);
  if (!hasPinata) return null;
  return ipfsGatewayUrl(cid);
}

export function isPinataConfigured() {
  return !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY);
}
