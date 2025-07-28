-- Update the handle_new_user function to use a new default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the default organization
  SELECT id INTO default_org_id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1;
  
  -- If no default organization exists, create it
  IF default_org_id IS NULL THEN
    INSERT INTO public.organizations (name) VALUES ('Veksla Bilhandel') RETURNING id INTO default_org_id;
  END IF;
  
  -- Create profile with data from user metadata
  INSERT INTO public.profiles (user_id, email, full_name, first_name, last_name, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    default_org_id
  );
  
  -- Assign default 'lager' role to new users (replacing bilhandel)
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'lager', default_org_id);
  
  RETURN NEW;
END;
$function$;