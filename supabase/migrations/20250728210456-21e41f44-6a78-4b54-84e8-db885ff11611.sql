-- Fix infinite recursion in user_roles policies once and for all

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Admins can view all roles in organization" ON public.user_roles;

-- Keep only the simple policy that allows users to see their own roles
-- This is all we need for the Settings component to work
CREATE POLICY "Simple user roles access" 
ON public.user_roles 
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- For admin functionality, we'll use the security definer function approach
-- Update the is_admin function to work properly
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;