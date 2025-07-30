-- First, remove orphaned account_mappings records that reference non-existent organizations
DELETE FROM public.account_mappings 
WHERE organization_id NOT IN (SELECT id FROM public.organizations);

-- Then add the foreign key constraint to cascade delete when organization is removed
ALTER TABLE public.account_mappings 
ADD CONSTRAINT fk_account_mappings_organization 
FOREIGN KEY (organization_id) 
REFERENCES public.organizations(id) 
ON DELETE CASCADE;