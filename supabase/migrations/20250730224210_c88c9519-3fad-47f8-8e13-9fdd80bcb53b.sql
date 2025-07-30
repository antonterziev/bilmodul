-- Update RLS policies for account_mappings to be organization-wide instead of user-specific

-- Drop the existing INSERT policy that requires user_id match
DROP POLICY IF EXISTS "Users can create account mappings in their organization" ON public.account_mappings;

-- Create new INSERT policy that only checks organization
CREATE POLICY "Users can create account mappings in their organization" 
ON public.account_mappings 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

-- Update the table to allow null user_id since it will be organization-wide
ALTER TABLE public.account_mappings ALTER COLUMN user_id DROP NOT NULL;

-- Create a function to populate default account mappings for an organization
CREATE OR REPLACE FUNCTION public.populate_default_account_mappings(_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    account_record RECORD;
    account_data jsonb[] := ARRAY[
        '{"number": "1410", "name": "Lager - VMB-bilar"}',
        '{"number": "1411", "name": "Lager - Momsbilar"}',
        '{"number": "1412", "name": "Lager - Momsbilar - EU"}',
        '{"number": "1413", "name": "Lager - VMB-bilar - EU"}',
        '{"number": "1414", "name": "Lager - Påkostnader"}',
        '{"number": "1510", "name": "Kundfordringar"}',
        '{"number": "1680", "name": "Förskottsbetalning"}',
        '{"number": "1930", "name": "Bankkonto 1"}',
        '{"number": "1931", "name": "Bankkonto 2"}',
        '{"number": "1932", "name": "Bankkonto 3"}',
        '{"number": "2440", "name": "Leverantörsskulder"}',
        '{"number": "2611", "name": "Utgående moms"}',
        '{"number": "2614", "name": "Omvänd utgående moms - matchas 2645"}',
        '{"number": "2616", "name": "Moms inköpsmarginalbeskattning"}',
        '{"number": "2641", "name": "Ingående moms"}',
        '{"number": "2645", "name": "Omvänd ingående moms - matchas 2614"}',
        '{"number": "3020", "name": "Försäljning VMB"}',
        '{"number": "3028", "name": "Beskattningsunderlag"}',
        '{"number": "3030", "name": "Omföringskonto beskattningsunderlag"}',
        '{"number": "3051", "name": "Försäljning Momsbil"}',
        '{"number": "3058", "name": "Försäljning inom EU"}',
        '{"number": "3590", "name": "Övrig försäljning"}',
        '{"number": "4010", "name": "Inköp - Momsbil"}',
        '{"number": "4011", "name": "Inköp - Momsbil EU"}',
        '{"number": "4020", "name": "Inköp - VMB"}',
        '{"number": "4021", "name": "Inköp - VMB EU"}',
        '{"number": "4030", "name": "Påkostnader"}',
        '{"number": "4515", "name": "Inköp av varor från EU"}',
        '{"number": "4519", "name": "Motkonto inköp av varor från EU"}',
        '{"number": "4531", "name": "Inköp av varor från EU"}',
        '{"number": "4539", "name": "Motkonto inköp av varor från EU"}'
    ]::jsonb[];
BEGIN
    -- Insert default account mappings for the organization
    FOR i IN 1..array_length(account_data, 1) LOOP
        INSERT INTO public.account_mappings (
            organization_id,
            account_name,
            account_number,
            user_id
        ) VALUES (
            _organization_id,
            account_data[i]->>'name',
            account_data[i]->>'number',
            NULL
        )
        ON CONFLICT (organization_id, account_name) DO NOTHING;
    END LOOP;
END;
$$;

-- Populate default mappings for existing organizations
DO $$
DECLARE
    org_record RECORD;
BEGIN
    FOR org_record IN SELECT id FROM public.organizations LOOP
        PERFORM public.populate_default_account_mappings(org_record.id);
    END LOOP;
END;
$$;