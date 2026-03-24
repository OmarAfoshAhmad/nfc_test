-- Atomic wallet apply function to prevent race conditions on balance updates
-- Applies ledger insert + balance update in a single DB transaction.

CREATE OR REPLACE FUNCTION public.wallet_apply_delta(
    p_customer_id INT,
    p_amount NUMERIC,
    p_type TEXT,
    p_reason TEXT,
    p_transaction_id INT DEFAULT NULL,
    p_admin_id INT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'wallet_apply_delta: customer_id is required';
    END IF;

    IF p_amount IS NULL OR p_amount = 0 THEN
        RAISE EXCEPTION 'wallet_apply_delta: amount must be non-zero';
    END IF;

    IF p_type NOT IN ('DEPOSIT', 'WITHDRAWAL', 'REFUND') THEN
        RAISE EXCEPTION 'wallet_apply_delta: invalid type %', p_type;
    END IF;

    -- Lock customer row to ensure linearizable balance updates.
    SELECT balance
    INTO v_current_balance
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'wallet_apply_delta: customer % not found', p_customer_id;
    END IF;

    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient wallet balance';
    END IF;

    INSERT INTO public.balance_ledger (
        customer_id,
        amount,
        type,
        reason,
        transaction_id,
        admin_id
    ) VALUES (
        p_customer_id,
        p_amount,
        p_type,
        p_reason,
        p_transaction_id,
        p_admin_id
    );

    UPDATE public.customers
    SET balance = v_new_balance
    WHERE id = p_customer_id;

    RETURN v_new_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wallet_apply_delta(INT, NUMERIC, TEXT, TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_apply_delta(INT, NUMERIC, TEXT, TEXT, INT, INT) TO service_role;
