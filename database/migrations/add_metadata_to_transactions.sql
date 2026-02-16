-- Add metadata column to transactions table for storing snapshot data (e.g. discount name)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN public.transactions.metadata IS 'Stores snapshot data like discount names, coupon codes, and other details at the time of transaction';
