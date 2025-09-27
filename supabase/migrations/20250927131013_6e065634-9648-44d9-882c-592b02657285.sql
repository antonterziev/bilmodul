-- Update Veksla Bilhandel organization with organization number
UPDATE public.organizations 
SET organization_number = '5593610388'
WHERE name ILIKE '%veksla%' OR name ILIKE '%veksla bilhandel%';