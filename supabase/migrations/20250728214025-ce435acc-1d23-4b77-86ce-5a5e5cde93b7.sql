-- Fix duplicate roles issue and consolidate admin/administrator
-- First, remove duplicate administrator roles where user already has admin role

-- Delete administrator roles where user already has admin role for the same organization
DELETE FROM public.user_roles 
WHERE role = 'administrator' 
AND EXISTS (
  SELECT 1 FROM public.user_roles ur2 
  WHERE ur2.user_id = user_roles.user_id 
  AND ur2.organization_id = user_roles.organization_id 
  AND ur2.role = 'admin'
);

-- Now update remaining administrator roles to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE role = 'administrator';

-- Update the has_role function to treat administrator = admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _organization_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'admin' AND role = 'administrator') OR (_role = 'administrator' AND role = 'admin'))
      AND (_organization_id IS NULL OR organization_id = _organization_id)
  )
$$;

-- Update the is_admin function to include administrator
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'administrator')
  )
$$;

-- Clean up duplicate RLS policies
DROP POLICY IF EXISTS "Administrators can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators can insert roles" ON public.user_roles; 
DROP POLICY IF EXISTS "Administrators can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can update user profiles" ON public.profiles;

-- Drop existing admin policies to recreate them
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;

-- Create single consolidated policy for admin role management
CREATE POLICY "Admins can manage roles" 
ON public.user_roles 
FOR ALL 
USING (is_admin());

-- Update profiles policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING ((auth.uid() = user_id) OR is_admin());