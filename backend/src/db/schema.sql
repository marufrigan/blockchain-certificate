-- Revocable Academic Certificate Management System - PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'UNIVERSITY_ADMIN', 'STUDENT');
CREATE TYPE certificate_status AS ENUM ('ACTIVE', 'REVOKED', 'REPLACED', 'SUPERSEDED');
CREATE TYPE tx_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    admin_wallet VARCHAR(42) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'UNIVERSITY_ADMIN',
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    wallet_address VARCHAR(42),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id VARCHAR(100) UNIQUE NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_id VARCHAR(100) NOT NULL,
    degree VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    issuer_wallet VARCHAR(42) NOT NULL,
    certificate_hash VARCHAR(66) NOT NULL,
    ipfs_cid VARCHAR(255) NOT NULL,
    status certificate_status NOT NULL DEFAULT 'ACTIVE',
    revocation_reason TEXT,
    previous_certificate_id VARCHAR(100),
    replaced_by_certificate_id VARCHAR(100),
    version_number INTEGER NOT NULL DEFAULT 1,
    university_id UUID REFERENCES universities(id),
    created_by UUID REFERENCES users(id),
    revoked_at TIMESTAMPTZ,
    replaced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS certificate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id VARCHAR(100) NOT NULL,
    related_certificate_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    old_status certificate_status,
    new_status certificate_status,
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    wallet_address VARCHAR(42),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id VARCHAR(100),
    tx_hash VARCHAR(66) NOT NULL,
    action VARCHAR(50) NOT NULL,
    status tx_status NOT NULL DEFAULT 'PENDING',
    gas_used VARCHAR(50),
    gas_price VARCHAR(50),
    block_number BIGINT,
    confirmation_time_ms INTEGER,
    network VARCHAR(50),
    from_address VARCHAR(42),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_university ON certificates(university_id);
CREATE INDEX IF NOT EXISTS idx_cert_history_cert ON certificate_history(certificate_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_cert ON blockchain_transactions(certificate_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
