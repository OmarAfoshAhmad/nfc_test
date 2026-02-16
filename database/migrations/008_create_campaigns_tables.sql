-- Create Campaigns Table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('AUTO_SPEND', 'BUNDLE', 'MANUAL', 'BROADCAST')),
    trigger_condition JSONB DEFAULT '{}'::jsonb, -- e.g. {"min_spend": 100}
    reward_config JSONB NOT NULL, -- e.g. {"type": "PERCENTAGE", "value": 10, "validity_days": 30}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Customer Coupons Table
CREATE TABLE IF NOT EXISTS public.customer_coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id INT REFERENCES public.customers(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL, -- Short unique code for display
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED')),
    metadata JSONB DEFAULT '{}'::jsonb, -- Store "reason" or other context here
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS (Optional, sticking to basic access for now as per project style)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_coupons ENABLE ROW LEVEL SECURITY;

-- Policy (Allow all for now for internal dashboard usage)
CREATE POLICY "Enable all access for authenticated users" ON public.campaigns FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.customer_coupons FOR ALL USING (true);
