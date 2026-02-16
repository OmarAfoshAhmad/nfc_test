-- Add 2FA columns to users table

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS two_factor_secret text,
ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS backup_codes text[]; -- Array of backup codes

-- Add comment
COMMENT ON COLUMN public.users.two_factor_secret IS 'Secret key for TOTP (2FA)';
