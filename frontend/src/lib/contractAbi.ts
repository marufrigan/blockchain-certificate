export const CERTIFICATE_REGISTRY_ABI = [
  "function registerUniversity(address wallet)",
  "function issueCertificate(string certificateId, string studentName, string studentId, string degree, string department, uint256 issueDate, bytes32 certificateHash, string ipfsCid, string previousCertificateId, uint256 versionNumber)",
  "function revokeCertificate(string certificateId, string reason)",
  "function replaceCertificate(string oldCertificateId, string newCertificateId, string studentName, string studentId, string degree, string department, uint256 issueDate, bytes32 certificateHash, string ipfsCid)",
  "function verifyCertificate(string certificateId) view returns (bool exists, bool isValid, uint8 status, string studentName, string degree, uint256 issueDate, string revocationReason, string replacedByCertificateId, string previousCertificateId, uint256 versionNumber, bytes32 certificateHash, string ipfsCid)",
  "function getCertificateHistory(string certificateId) view returns (string[] historyIds, tuple(string certificateId, string studentName, string studentId, string degree, string department, uint256 issueDate, address issuerWallet, bytes32 certificateHash, string ipfsCid, uint8 status, string revocationReason, string previousCertificateId, string replacedByCertificateId, uint256 versionNumber, uint256 revokedAt, uint256 replacedAt)[] historyCerts)",
] as const;

export const STATUS_LABELS = ["ACTIVE", "REVOKED", "REPLACED", "SUPERSEDED"] as const;
