// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CertificateRegistry
 * @notice On-chain academic certificate lifecycle: issue, verify, revoke, replace.
 * Full certificate metadata and PDF live off-chain (IPFS + PostgreSQL); chain stores hash, CID, status, and audit links.
 */
contract CertificateRegistry is AccessControl {
    bytes32 public constant SUPER_ADMIN_ROLE = keccak256("SUPER_ADMIN_ROLE");
    bytes32 public constant UNIVERSITY_ADMIN_ROLE = keccak256("UNIVERSITY_ADMIN_ROLE");

    enum CertificateStatus {
        ACTIVE,
        REVOKED,
        REPLACED,
        SUPERSEDED
    }

    struct Certificate {
        string certificateId;
        string studentName;
        string studentId;
        string degree;
        string department;
        uint256 issueDate;
        address issuerWallet;
        bytes32 certificateHash;
        string ipfsCid;
        CertificateStatus status;
        string revocationReason;
        string previousCertificateId;
        string replacedByCertificateId;
        uint256 versionNumber;
        uint256 revokedAt;
        uint256 replacedAt;
    }

    // certificateId => Certificate
    mapping(string => Certificate) private certificates;
    // university wallet => registered
    mapping(address => bool) public registeredUniversities;
    // certificateId => history chain (root to leaf certificate IDs)
    mapping(string => string[]) private certificateHistory;
    // track active certificate IDs (only one ACTIVE per ID at a time)
    mapping(string => bool) private activeCertificateIds;

    string[] private allCertificateIds;

    event UniversityRegistered(address indexed wallet, address indexed registeredBy);
    event CertificateIssued(
        string indexed certificateId,
        string studentId,
        address indexed issuer,
        uint256 versionNumber,
        bytes32 certificateHash,
        string ipfsCid
    );
    event CertificateRevoked(
        string indexed certificateId,
        address indexed revoker,
        string reason,
        uint256 revokedAt
    );
    event CertificateReplaced(
        string indexed oldCertificateId,
        string indexed newCertificateId,
        address indexed issuer,
        uint256 oldVersion,
        uint256 newVersion
    );

    constructor(address superAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, superAdmin);
        _grantRole(SUPER_ADMIN_ROLE, superAdmin);
    }

    function registerUniversity(address wallet) external onlyRole(SUPER_ADMIN_ROLE) {
        require(wallet != address(0), "Invalid wallet");
        registeredUniversities[wallet] = true;
        _grantRole(UNIVERSITY_ADMIN_ROLE, wallet);
        emit UniversityRegistered(wallet, msg.sender);
    }

    function issueCertificate(
        string calldata certificateId,
        string calldata studentName,
        string calldata studentId,
        string calldata degree,
        string calldata department,
        uint256 issueDate,
        bytes32 certificateHash,
        string calldata ipfsCid,
        string calldata previousCertificateId,
        uint256 versionNumber
    ) external onlyRole(UNIVERSITY_ADMIN_ROLE) {
        require(registeredUniversities[msg.sender], "Issuer not registered university");
        require(bytes(certificateId).length > 0, "Empty certificate ID");
        require(!_certificateExists(certificateId), "Certificate ID already exists");
        require(certificateHash != bytes32(0), "Invalid hash");
        require(bytes(ipfsCid).length > 0, "Empty IPFS CID");

        certificates[certificateId] = Certificate({
            certificateId: certificateId,
            studentName: studentName,
            studentId: studentId,
            degree: degree,
            department: department,
            issueDate: issueDate,
            issuerWallet: msg.sender,
            certificateHash: certificateHash,
            ipfsCid: ipfsCid,
            status: CertificateStatus.ACTIVE,
            revocationReason: "",
            previousCertificateId: previousCertificateId,
            replacedByCertificateId: "",
            versionNumber: versionNumber == 0 ? 1 : versionNumber,
            revokedAt: 0,
            replacedAt: 0
        });

        activeCertificateIds[certificateId] = true;
        allCertificateIds.push(certificateId);
        _appendToHistory(certificateId, certificateId);

        if (bytes(previousCertificateId).length > 0) {
            _linkHistory(previousCertificateId, certificateId);
        }

        emit CertificateIssued(
            certificateId,
            studentId,
            msg.sender,
            versionNumber == 0 ? 1 : versionNumber,
            certificateHash,
            ipfsCid
        );
    }

    function revokeCertificate(
        string calldata certificateId,
        string calldata reason
    ) external onlyRole(UNIVERSITY_ADMIN_ROLE) {
        require(_certificateExists(certificateId), "Certificate not found");
        Certificate storage cert = certificates[certificateId];
        require(cert.status == CertificateStatus.ACTIVE, "Only ACTIVE certificates can be revoked");
        require(bytes(reason).length > 0, "Revocation reason required");

        cert.status = CertificateStatus.REVOKED;
        cert.revocationReason = reason;
        cert.revokedAt = block.timestamp;
        activeCertificateIds[certificateId] = false;

        emit CertificateRevoked(certificateId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Replace an ACTIVE certificate with a new version. Old cert becomes REPLACED; prior versions in chain may be SUPERSEDED.
     */
    function replaceCertificate(
        string calldata oldCertificateId,
        string calldata newCertificateId,
        string calldata studentName,
        string calldata studentId,
        string calldata degree,
        string calldata department,
        uint256 issueDate,
        bytes32 certificateHash,
        string calldata ipfsCid
    ) external onlyRole(UNIVERSITY_ADMIN_ROLE) {
        require(_certificateExists(oldCertificateId), "Old certificate not found");
        Certificate storage oldCert = certificates[oldCertificateId];
        require(oldCert.status == CertificateStatus.ACTIVE, "Only ACTIVE certificates can be replaced");
        require(!_certificateExists(newCertificateId), "New certificate ID already exists");
        require(certificateHash != bytes32(0), "Invalid hash");

        uint256 newVersion = oldCert.versionNumber + 1;

        oldCert.status = CertificateStatus.REPLACED;
        oldCert.replacedByCertificateId = newCertificateId;
        oldCert.replacedAt = block.timestamp;
        activeCertificateIds[oldCertificateId] = false;

        // Mark earlier versions in history as SUPERSEDED (except the direct old cert which is REPLACED)
        string[] storage history = certificateHistory[oldCertificateId];
        for (uint256 i = 0; i < history.length - 1; i++) {
            string memory histId = history[i];
            if (
                certificates[histId].status != CertificateStatus.REVOKED &&
                certificates[histId].status != CertificateStatus.REPLACED
            ) {
                certificates[histId].status = CertificateStatus.SUPERSEDED;
                activeCertificateIds[histId] = false;
            }
        }

        certificates[newCertificateId] = Certificate({
            certificateId: newCertificateId,
            studentName: studentName,
            studentId: studentId,
            degree: degree,
            department: department,
            issueDate: issueDate,
            issuerWallet: msg.sender,
            certificateHash: certificateHash,
            ipfsCid: ipfsCid,
            status: CertificateStatus.ACTIVE,
            revocationReason: "",
            previousCertificateId: oldCertificateId,
            replacedByCertificateId: "",
            versionNumber: newVersion,
            revokedAt: 0,
            replacedAt: 0
        });

        activeCertificateIds[newCertificateId] = true;
        allCertificateIds.push(newCertificateId);
        _linkHistory(oldCertificateId, newCertificateId);

        emit CertificateReplaced(
            oldCertificateId,
            newCertificateId,
            msg.sender,
            oldCert.versionNumber,
            newVersion
        );
        emit CertificateIssued(
            newCertificateId,
            studentId,
            msg.sender,
            newVersion,
            certificateHash,
            ipfsCid
        );
    }

    function verifyCertificate(string calldata certificateId)
        external
        view
        returns (
            bool exists,
            bool isValid,
            CertificateStatus status,
            string memory studentName,
            string memory degree,
            uint256 issueDate,
            string memory revocationReason,
            string memory replacedByCertificateId,
            string memory previousCertificateId,
            uint256 versionNumber,
            bytes32 certificateHash,
            string memory ipfsCid
        )
    {
        if (!_certificateExists(certificateId)) {
            return (false, false, CertificateStatus.ACTIVE, "", "", 0, "", "", "", 0, bytes32(0), "");
        }

        Certificate storage cert = certificates[certificateId];
        bool valid = cert.status == CertificateStatus.ACTIVE;

        return (
            true,
            valid,
            cert.status,
            cert.studentName,
            cert.degree,
            cert.issueDate,
            cert.revocationReason,
            cert.replacedByCertificateId,
            cert.previousCertificateId,
            cert.versionNumber,
            cert.certificateHash,
            cert.ipfsCid
        );
    }

    function getCertificate(string calldata certificateId) external view returns (Certificate memory) {
        require(_certificateExists(certificateId), "Certificate not found");
        return certificates[certificateId];
    }

    function getCertificateHistory(string calldata certificateId)
        external
        view
        returns (string[] memory historyIds, Certificate[] memory historyCerts)
    {
        require(_certificateExists(certificateId), "Certificate not found");
        string[] storage ids = certificateHistory[certificateId];
        historyIds = new string[](ids.length);
        historyCerts = new Certificate[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            historyIds[i] = ids[i];
            historyCerts[i] = certificates[ids[i]];
        }
    }

    function isActiveCertificate(string calldata certificateId) external view returns (bool) {
        return activeCertificateIds[certificateId] && certificates[certificateId].status == CertificateStatus.ACTIVE;
    }

    function getAllCertificateIds() external view returns (string[] memory) {
        return allCertificateIds;
    }

    function _certificateExists(string memory certificateId) private view returns (bool) {
        return bytes(certificates[certificateId].certificateId).length > 0;
    }

    function _appendToHistory(string memory rootId, string memory certId) private {
        if (certificateHistory[rootId].length == 0) {
            certificateHistory[rootId].push(certId);
        }
    }

    function _linkHistory(string memory oldId, string memory newId) private {
        string[] storage oldHistory = certificateHistory[oldId];
        if (oldHistory.length == 0) {
            oldHistory.push(oldId);
        }
        oldHistory.push(newId);
        certificateHistory[newId] = oldHistory;
    }
}
