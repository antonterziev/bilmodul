-- Add organization_number column to organizations table
ALTER TABLE public.organizations 
ADD COLUMN organization_number text NOT NULL DEFAULT '';