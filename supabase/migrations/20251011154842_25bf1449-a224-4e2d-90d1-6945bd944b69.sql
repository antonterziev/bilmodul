-- Make old token columns nullable since we now use encrypted columns
ALTER TABLE public.fortnox_integrations 
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN refresh_token DROP NOT NULL;