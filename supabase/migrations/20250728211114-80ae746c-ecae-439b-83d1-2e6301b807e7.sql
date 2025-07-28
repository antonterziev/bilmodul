-- Fix organizations table RLS policies to allow users to view their organization

-- Check current policies and fix them
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Administrators can manage organizations" ON public.organizations;
DROP POLICY IF EXISTS "Administrators and superusers can manage organizations" ON public.organizations;

-- Create a simple policy that allows users to view their organization
CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  id IN (
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Allow admins to manage organizations
CREATE POLICY "Admins can manage organizations" 
ON public.organizations 
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());