-- Step 1: Create new enum with all existing permissions
CREATE TYPE public.app_permission AS ENUM ('admin', 'lager', 'superuser', 'administrator', 'ekonomi');

-- Step 2: Create new user_permissions table (without organization_id since users belong to one org)
CREATE TABLE public.user_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission app_permission NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, permission)
);

-- Step 3: Enable RLS on new table
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Step 4: Migrate data from user_roles to user_permissions (without organization_id)
INSERT INTO public.user_permissions (user_id, permission, created_at)
SELECT DISTINCT user_id, role::text::app_permission, created_at
FROM public.user_roles;

-- Step 5: Create updated functions with permission terminology
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission IN ('admin', 'administrator', 'superuser')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_permission()
RETURNS app_permission
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT permission 
  FROM public.user_permissions 
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_remove_admin_permission(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (
    SELECT COUNT(*) 
    FROM public.user_permissions up
    JOIN public.profiles p ON up.user_id = p.user_id
    WHERE up.permission IN ('admin', 'administrator', 'superuser')
    AND p.organization_id = _organization_id
    AND up.user_id != _user_id
  ) > 0
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get user's organization from profiles
  SELECT organization_id INTO user_org_id 
  FROM public.profiles 
  WHERE user_id = OLD.user_id;
  
  -- If removing an admin permission, check if it's the last one in the organization
  IF OLD.permission IN ('admin', 'administrator', 'superuser') THEN
    IF NOT public.can_remove_admin_permission(OLD.user_id, user_org_id) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Step 6: Create RLS policies for user_permissions
CREATE POLICY "Admins can manage permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Step 7: Create trigger for admin removal validation
CREATE TRIGGER validate_admin_permission_removal
BEFORE DELETE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.validate_admin_removal();

-- Step 8: Update handle_new_user function to use permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
  
  -- Assign default 'lager' permission to new users
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES (NEW.id, 'lager');
  
  RETURN NEW;
END;
$$;

-- Step 9: Update inventory_items policies to use profiles organization_id only
DROP POLICY IF EXISTS "Users can view inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can create inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can delete inventory items in their organization" ON public.inventory_items;

CREATE POLICY "Users can view inventory items in their organization"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create inventory items in their organization"
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND 
  organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update inventory items in their organization"
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete inventory items in their organization"
ON public.inventory_items
FOR DELETE
TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Step 10: Update invitations policies
DROP POLICY IF EXISTS "Users can view invitations in their organization" ON public.invitations;

CREATE POLICY "Users can view invitations in their organization"
ON public.invitations
FOR SELECT
TO authenticated
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Step 11: Update profiles policies  
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (organization_id = (SELECT organization_id FROM public.profiles p WHERE p.user_id = auth.uid())) OR 
  is_admin()
);

-- Step 12: Drop old table and enum (after data migration)
DROP TABLE public.user_roles CASCADE;
DROP TYPE public.app_role CASCADE;