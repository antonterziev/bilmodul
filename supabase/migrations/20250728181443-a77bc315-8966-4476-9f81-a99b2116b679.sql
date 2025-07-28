-- Fix infinite recursion in user_roles policies
-- Drop the problematic policies
DROP POLICY IF EXISTS "Administrators and superusers can view roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can update roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can delete roles" ON user_roles;

-- Recreate policies without referencing user_roles table in the conditions
CREATE POLICY "Administrators and superusers can view roles" 
ON user_roles 
FOR SELECT 
USING (
  -- Users can see their own roles
  auth.uid() = user_id
  OR
  -- Administrators and superusers can see all roles (using the security definer function)
  public.get_current_user_role() = 'administrator'::app_role
  OR
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can update roles" 
ON user_roles 
FOR UPDATE 
USING (
  public.get_current_user_role() = 'administrator'::app_role
  OR
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (
  public.get_current_user_role() = 'administrator'::app_role
  OR
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can delete roles" 
ON user_roles 
FOR DELETE 
USING (
  public.get_current_user_role() = 'administrator'::app_role
  OR
  public.get_current_user_role() = 'superuser'::app_role
);

-- Also fix the other policies that might have similar issues
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;

CREATE POLICY "Users can view their organization" 
ON organizations 
FOR SELECT 
USING (
  -- Regular users can see their own organization (using a simpler approach)
  id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  OR 
  -- Superusers can see all organizations
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Users can view profiles in their organization" 
ON profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles in their organization (using a simpler approach)
  organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  OR
  -- Superusers can see all profiles
  public.get_current_user_role() = 'superuser'::app_role
);