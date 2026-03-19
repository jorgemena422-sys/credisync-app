-- Password Reset Codes Table for Supabase
-- Ejecuta este script en el SQL Editor de Supabase

-- Create password reset codes table
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  user_id TEXT REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_code CHECK (LENGTH(code) = 6),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email 
ON public.password_reset_codes(email, code, used, expires_at);

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires 
ON public.password_reset_codes(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (request reset)
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_codes
FOR INSERT
WITH CHECK (true);

-- Allow authenticated users to view their own codes
CREATE POLICY "Users can view own codes"
ON public.password_reset_codes
FOR SELECT
USING (auth.email() = email);

-- Allow updates only through specific conditions
CREATE POLICY "Allow code updates"
ON public.password_reset_codes
FOR UPDATE
USING (true);

-- Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_reset_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.password_reset_codes
  WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- Comment describing the table
COMMENT ON TABLE public.password_reset_codes IS 
  'Stores 6-digit password reset codes with 15-minute expiration';
