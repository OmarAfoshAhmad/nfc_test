-- NFC Discount System Schema
-- Database is selected via connection string/env variables


-- Users (Admins)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'staff') DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    points_balance INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Cards (NFC Tags)
CREATE TABLE IF NOT EXISTS cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) NOT NULL UNIQUE, -- The UID from the NFC card
    customer_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- Settings (System Configuration)
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(50) NOT NULL UNIQUE,
    value VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tiers (Loyalty Levels - Optional for now but good to have)
CREATE TABLE IF NOT EXISTS tiers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- Bronze, Silver, Gold
    min_points INT NOT NULL, -- Points needed to reach this tier
    multiplier DECIMAL(3, 2) DEFAULT 1.00, -- Point earning multiplier
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discounts (Updated)
CREATE TABLE IF NOT EXISTS discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('percentage', 'fixed_amount', 'gift') NOT NULL,
    value DECIMAL(10, 2) NOT NULL, -- Percentage or Amount
    points_required INT DEFAULT 0, -- Points needed to redeem
    start_date DATETIME, -- Validity period
    end_date DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (Scan History)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    card_id INT,
    discount_id INT,
    amount_before DECIMAL(10, 2),
    amount_after DECIMAL(10, 2),
    points_earned INT DEFAULT 0, -- Track points earned in this transaction
    status ENUM('success', 'failed') DEFAULT 'success',
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (card_id) REFERENCES cards(id),
    FOREIGN KEY (discount_id) REFERENCES discounts(id)
);

-- Points Ledger (Audit Trail - moved after transactions if it references it)
CREATE TABLE IF NOT EXISTS points_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    transaction_id INT, -- Optional, link to purchase
    admin_id INT, -- Optional, if manual adjustment
    points INT NOT NULL, -- Positive for earn, negative for spend
    reason VARCHAR(255), -- "Purchase", "Redemption", "Manual Adjustment"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Audit Logs (Admin Actions)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- e.g., 'UPDATE_SETTINGS', 'CREATE_DISCOUNT'
    details TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- Login Attempts (Rate Limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    username VARCHAR(50) NOT NULL,
    attempt_count INT DEFAULT 1,
    last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP NULL,
    UNIQUE KEY unique_ip_user (ip_address, username)
);

-- ========================================================
-- INDEXES & OPTIMIZATIONS
-- ========================================================

-- Transactions
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_discount_id ON transactions(discount_id);

-- Points Ledger
CREATE INDEX idx_points_customer_id ON points_ledger(customer_id);
CREATE INDEX idx_points_transaction_id ON points_ledger(transaction_id);
CREATE INDEX idx_points_created_at ON points_ledger(created_at DESC);

-- Cards
CREATE INDEX idx_cards_customer_id ON cards(customer_id);
CREATE INDEX idx_cards_is_active ON cards(is_active);
CREATE INDEX idx_cards_uid ON cards(uid);

-- Customers
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

-- Audit Logs
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_action_type ON audit_logs(action_type);

-- Login Attempts
CREATE INDEX idx_login_attempts_locked_until ON login_attempts(locked_until);
CREATE INDEX idx_login_attempts_last_attempt ON login_attempts(last_attempt_at DESC);

-- Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Terminals Table (NFC Reader Machines)
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

-- Indexes for branches/terminals
CREATE INDEX idx_terminals_branch_id ON terminals(branch_id);
CREATE INDEX idx_terminals_is_active ON terminals(is_active);
CREATE INDEX idx_branches_is_active ON branches(is_active);
