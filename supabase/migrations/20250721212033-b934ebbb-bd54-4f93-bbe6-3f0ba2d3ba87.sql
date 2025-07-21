
-- Add columns to track OAuth authorization codes
ALTER TABLE public.fortnox_integrations 
ADD COLUMN oauth_code TEXT,
ADD COLUMN code_used_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster code lookups
CREATE INDEX idx_fortnox_integrations_oauth_code ON public.fortnox_integrations(oauth_code);
