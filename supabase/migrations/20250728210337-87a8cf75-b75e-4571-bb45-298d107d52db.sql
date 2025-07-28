-- Fix user_roles RLS policies - they're preventing users from seeing their own roles

-- Drop all existing conflicting policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Create simple, working policies
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles in organization" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.user_roles admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.role = 'admin'
    AND admin_check.organization_id = user_roles.organization_id
  )
);