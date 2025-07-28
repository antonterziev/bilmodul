-- Update invitations table to support multiple roles
-- Add a new column for storing multiple roles as an array
ALTER TABLE public.invitations 
ADD COLUMN roles app_role[] DEFAULT ARRAY['lager'::app_role];

-- Update existing invitations to use the new roles array column
UPDATE public.invitations 
SET roles = ARRAY[role];

-- Drop the old single role column (after data migration)
ALTER TABLE public.invitations 
DROP COLUMN role;