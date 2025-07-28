-- Second migration: Update anton.terziev@outlook.com to be a superuser and update policies
UPDATE user_roles 
SET role = 'superuser' 
WHERE user_id = '8b3b5cbd-4320-4dce-bd70-5526a0db40de';

-- Update organizations policies to allow superusers to see all organizations
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Administrators and superusers can manage organizations" ON organizations;

CREATE POLICY "Users can view their organization" 
ON organizations 
FOR SELECT 
USING (
  -- Regular users can see their own organization
  id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  OR 
  -- Superusers can see all organizations
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can manage organizations" 
ON organizations 
FOR ALL 
USING (
  -- Administrators can manage their own organization
  (public.get_current_user_role() = 'administrator'::app_role AND id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  OR 
  -- Superusers can manage all organizations
  public.get_current_user_role() = 'superuser'::app_role
);

-- Update profiles policies to allow superusers to see all profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;

CREATE POLICY "Users can view profiles in their organization" 
ON profiles 
FOR SELECT 
USING (
  -- Users can see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles in their organization
  organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  OR
  -- Superusers can see all profiles
  public.get_current_user_role() = 'superuser'::app_role
);

-- Update user_roles policies to allow superusers to see all roles
DROP POLICY IF EXISTS "Administrators and superusers can view roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can update roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can delete roles" ON user_roles;

CREATE POLICY "Administrators and superusers can view roles" 
ON user_roles 
FOR SELECT 
USING (
  -- Users can see their own roles
  auth.uid() = user_id
  OR
  -- Administrators can see roles in their organization
  (public.get_current_user_role() = 'administrator'::app_role AND organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  OR
  -- Superusers can see all roles
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can update roles" 
ON user_roles 
FOR UPDATE 
USING (
  -- Administrators can update roles in their organization
  (public.get_current_user_role() = 'administrator'::app_role AND organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  OR
  -- Superusers can update all roles
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (
  -- Administrators can insert roles in their organization
  (public.get_current_user_role() = 'administrator'::app_role AND organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  OR
  -- Superusers can insert any roles
  public.get_current_user_role() = 'superuser'::app_role
);

CREATE POLICY "Administrators and superusers can delete roles" 
ON user_roles 
FOR DELETE 
USING (
  -- Administrators can delete roles in their organization
  (public.get_current_user_role() = 'administrator'::app_role AND organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  OR
  -- Superusers can delete any roles
  public.get_current_user_role() = 'superuser'::app_role
);