-- Add foreign key constraint to account_mappings to cascade delete when organization is removed
ALTER TABLE public.account_mappings 
ADD CONSTRAINT fk_account_mappings_organization 
FOREIGN KEY (organization_id) 
REFERENCES public.organizations(id) 
ON DELETE CASCADE;