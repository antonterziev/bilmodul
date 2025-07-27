-- Fix infinite recursion in user_roles policies
-- Drop the problematic policies first
DROP POLICY IF EXISTS "Administrators can view roles in their organization" ON public.user_roles;
DROP POLICY IF EXISTS "Administrators can manage roles in their organization" ON public.user_roles;

-- Create simpler, non-recursive policies for user_roles
CREATE POLICY "Administrators can view roles in their organization" 
ON public.user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'administrator'::app_role 
    AND ur.organization_id = user_roles.organization_id
  )
);

CREATE POLICY "Administrators can manage roles in their organization" 
ON public.user_roles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'administrator'::app_role 
    AND ur.organization_id = user_roles.organization_id
  )
);