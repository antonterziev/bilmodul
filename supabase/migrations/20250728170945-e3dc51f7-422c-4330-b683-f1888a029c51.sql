-- Drop existing problematic policies
DROP POLICY IF EXISTS "Administrators can manage roles in their organization" ON user_roles;
DROP POLICY IF EXISTS "Administrators can view roles in their organization" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create new policies without recursion
CREATE POLICY "Users can view their own roles" 
ON user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Administrators can view all roles" 
ON user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.role = 'administrator'::app_role
  )
);

CREATE POLICY "Administrators can update roles" 
ON user_roles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.role = 'administrator'::app_role
  )
);

CREATE POLICY "Administrators can insert roles" 
ON user_roles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.role = 'administrator'::app_role
  )
);