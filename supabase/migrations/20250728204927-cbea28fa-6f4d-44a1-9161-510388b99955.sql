-- Fix RLS policies for user_roles table to work with 'admin' role instead of 'administrator'

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Administrators and superusers can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators and superusers can view roles" ON public.user_roles;

-- Create new policies that work with the 'admin' role
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'
  )
);