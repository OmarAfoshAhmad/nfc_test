-- Create Campaign Progress Table (for Stamp Cards)
CREATE TABLE IF NOT EXISTS public.customer_campaign_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id INT REFERENCES public.customers(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    current_count INT DEFAULT 0,
    target_count INT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, campaign_id)
);

-- Enable RLS
ALTER TABLE public.customer_campaign_progress ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Enable all access for authenticated users" ON public.customer_campaign_progress FOR ALL USING (true);
