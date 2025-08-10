-- Clean up user data for a specific email in the current organization
DO $$
DECLARE
  target_email text := 'tony.terziev@gmail.com';
  org_id uuid;
BEGIN
  -- Get the organization's id (Veksla Bilhandel)
  SELECT id INTO org_id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1;

  -- Safety check: only proceed if org exists
  IF org_id IS NOT NULL THEN
    -- Remove invitations for that email in the org
    DELETE FROM public.invitations 
    WHERE email = target_email 
      AND organization_id = org_id;

    -- Remove user permissions for any profiles with that email in the org
    DELETE FROM public.user_permissions up
    USING public.profiles p
    WHERE up.user_id = p.user_id
      AND p.email = target_email
      AND p.organization_id = org_id;

    -- Remove the profile for that email in the org
    DELETE FROM public.profiles p
    WHERE p.email = target_email
      AND p.organization_id = org_id;
  END IF;
END $$;