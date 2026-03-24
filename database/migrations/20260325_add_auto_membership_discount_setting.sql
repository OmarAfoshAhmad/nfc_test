-- Add admin-controlled setting for automatic membership discount.
-- Non-destructive migration: inserts only if missing.

INSERT INTO public.settings (key_name, value)
VALUES ('auto_membership_discount', 'false')
ON CONFLICT (key_name) DO NOTHING;
