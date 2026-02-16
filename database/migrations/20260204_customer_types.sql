-- ==========================================
-- إضافة نظام أنواع العملاء (عازب / عائلة)
-- Customer Types System (Single / Family)
-- Migration Date: 2026-02-04
-- ==========================================

BEGIN;

-- ==========================================
-- 1. إضافة حقول لجدول العملاء (customers)
-- ==========================================

-- نوع العميل: عازب (single) أو عائلة (family)
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'single' 
        CHECK (type IN ('single', 'family'));

-- نسبة الخصم المخصصة (NULL = استخدام الافتراضي حسب النوع)
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT NULL;

-- تعليق توضيحي
COMMENT ON COLUMN public.customers.type IS 'نوع العميل: single (عازب 10%) أو family (عائلة 20%)';
COMMENT ON COLUMN public.customers.discount_percent IS 'نسبة خصم مخصصة. NULL = استخدام الافتراضي';

-- ==========================================
-- 2. إضافة حقل لجدول الحملات/الباقات (campaigns)
-- ==========================================

-- نوع العميل المستهدف (NULL = للجميع)
ALTER TABLE public.campaigns 
    ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT NULL 
        CHECK (customer_type IS NULL OR customer_type IN ('single', 'family'));

COMMENT ON COLUMN public.campaigns.customer_type IS 'نوع العميل المستهدف. NULL = متاح للجميع';

-- ==========================================
-- 3. إنشاء دالة لحساب الخصم الفعلي
-- ==========================================

CREATE OR REPLACE FUNCTION get_effective_discount(p_customer_id INT)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_custom_discount DECIMAL(5,2);
    v_type TEXT;
BEGIN
    SELECT discount_percent, type INTO v_custom_discount, v_type
    FROM public.customers
    WHERE id = p_customer_id;
    
    -- إذا لديه خصم مخصص، استخدمه
    IF v_custom_discount IS NOT NULL THEN
        RETURN v_custom_discount;
    END IF;
    
    -- وإلا استخدم الافتراضي حسب النوع
    IF v_type = 'family' THEN
        RETURN 20.00;
    ELSE
        RETURN 10.00;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
