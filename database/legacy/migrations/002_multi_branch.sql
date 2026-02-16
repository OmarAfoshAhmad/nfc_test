-- Migration: Add Multi-Branch & Terminal Support
-- Run this on your local MySQL database: nfc_discount_system

CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terminals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    branch_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    connection_url VARCHAR(255), -- ws:// or wss:// URL (Optional if using Push)
    terminal_secret VARCHAR(100) NOT NULL, -- Secret for push-based ingestion
    is_active TINYINT(1) DEFAULT 1,
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- Seed some initial data for testing
INSERT INTO branches (name, location) VALUES ('الفرع الرئيسي', 'البداية');
INSERT INTO terminals (branch_id, name, terminal_secret) VALUES (1, 'كاشير 1', 'test-secret-123');

-- Indexes
CREATE INDEX idx_terminals_branch_id ON terminals(branch_id);
CREATE INDEX idx_branches_is_active ON branches(is_active);
