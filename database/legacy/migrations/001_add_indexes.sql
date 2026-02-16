-- Database Performance Optimizations
-- Add indexes for frequently queried columns

-- Transactions table indexes
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_discount_id ON transactions(discount_id);

-- Points ledger indexes
CREATE INDEX IF NOT EXISTS idx_points_customer_id ON points_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_points_transaction_id ON points_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_points_created_at ON points_ledger(created_at DESC);

-- Cards table indexes
CREATE INDEX IF NOT EXISTS idx_cards_customer_id ON cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_cards_is_active ON cards(is_active);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Discounts table indexes
CREATE INDEX IF NOT EXISTS idx_discounts_is_active ON discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_dates ON discounts(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_discounts_points ON discounts(points_required);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_logs(action_type);

-- Login attempts indexes (already has UNIQUE KEY, but add for performance)
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until);
CREATE INDEX IF NOT EXISTS idx_login_attempts_last_attempt ON login_attempts(last_attempt_at DESC);
