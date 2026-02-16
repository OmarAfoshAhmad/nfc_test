-- ==========================================
-- إصلاح سياسات RLS للجداول الحساسة
-- Fix RLS Policies for Sensitive Tables
-- Migration Date: 2026-02-04
-- ==========================================

BEGIN;

-- ==========================================
-- 1. إصلاح سياسات جدول العملاء (Customers)
-- ==========================================

-- إسقاط السياسة القديمة
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

-- سياسة القراءة: جميع المصادقين يمكنهم الرؤية
CREATE POLICY "Staff can view customers"
ON public.customers FOR SELECT
TO authenticated
USING (true);

-- سياسة الإدارة: فقط الإداريون
CREATE POLICY "Admins can manage customers"
ON public.customers FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
);

-- ==========================================
-- 2. إضافة RLS لجدول البطاقات (Cards)
-- ==========================================

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- إسقاط أي سياسات قديمة
DROP POLICY IF EXISTS "Authenticated can view cards" ON public.cards;
DROP POLICY IF EXISTS "Admins can manage cards" ON public.cards;

-- سياسة القراءة: جميع المصادقين
CREATE POLICY "Authenticated can view cards"
ON public.cards FOR SELECT
TO authenticated
USING (true);

-- سياسة الإدارة: فقط الإداريون
CREATE POLICY "Admins can manage cards"
ON public.cards FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
);

-- ==========================================
-- 3. إضافة RLS لجدول المعاملات (Transactions)
-- ==========================================

-- تحديث السياسة الحالية
DROP POLICY IF EXISTS "Authenticated users can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Authenticated users can create transactions" ON public.transactions;

CREATE POLICY "Authenticated can view transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Staff can create transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can manage transactions"
ON public.transactions FOR UPDATE
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
);

CREATE POLICY "Superadmins can delete transactions"
ON public.transactions FOR DELETE
TO authenticated
USING (
    (auth.jwt() ->> 'role') = 'superadmin'
);

-- ==========================================
-- 4. إضافة RLS لجدول الخصومات (Discounts)
-- ==========================================

ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view discounts"
ON public.discounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage discounts"
ON public.discounts FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
);

-- ==========================================
-- 5. إضافة RLS لجدول المحطات (Terminals)
-- ==========================================

ALTER TABLE public.terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view terminals"
ON public.terminals FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage terminals"
ON public.terminals FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
);

-- السماح لـ service_role بالوصول الكامل (لـ NFC Bridge)
CREATE POLICY "Service role full access"
ON public.terminals FOR ALL
USING (auth.role() = 'service_role');

COMMIT;
