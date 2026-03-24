-- Performance indexes to keep scan/cards workflows responsive with 100+ cards.

-- Cards listing and recycle-bin queries
CREATE INDEX IF NOT EXISTS idx_cards_deleted_created
ON public.cards (deleted_at, created_at DESC);

-- Fast UID lookup for scan path
CREATE INDEX IF NOT EXISTS idx_cards_uid_active
ON public.cards (uid, is_active)
WHERE deleted_at IS NULL;

-- Fast coupon lookup for active wallet items by customer
CREATE INDEX IF NOT EXISTS idx_customer_coupons_customer_status_expiry
ON public.customer_coupons (customer_id, status, expires_at DESC);

-- Fast terminal scan polling path
CREATE INDEX IF NOT EXISTS idx_scan_events_terminal_processed_created
ON public.scan_events (terminal_id, processed, created_at DESC);
