-- Add permissions column to invitations table
ALTER TABLE public.invitations 
ADD COLUMN permissions TEXT[] DEFAULT ARRAY[]::TEXT[];