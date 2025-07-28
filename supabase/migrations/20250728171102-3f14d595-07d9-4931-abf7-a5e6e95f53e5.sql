-- Drop all existing user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators can view all roles" ON user_roles;  
DROP POLICY IF EXISTS "Administrators can update roles" ON user_roles;
DROP POLICY IF EXISTS "Administrators can insert roles" ON user_roles;

-- Create a security definer function to get current user role without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Create simple non-recursive policies
CREATE POLICY "Users can view their own roles" 
ON user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Administrators can view all roles" 
ON user_roles 
FOR SELECT 
USING (public.get_current_user_role() = 'administrator'::app_role);

CREATE POLICY "Administrators can update roles" 
ON user_roles 
FOR UPDATE 
USING (public.get_current_user_role() = 'administrator'::app_role);

CREATE POLICY "Administrators can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (public.get_current_user_role() = 'administrator'::app_role);

CREATE POLICY "Administrators can delete roles" 
ON user_roles 
FOR DELETE 
USING (public.get_current_user_role() = 'administrator'::app_role);