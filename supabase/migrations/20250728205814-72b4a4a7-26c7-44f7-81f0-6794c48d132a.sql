-- Fix profiles table RLS policies to allow proper access

-- Update the profiles insert policy to be more permissive
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Ensure users can view and update their profiles without organization restrictions
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  organization_id IN (
    SELECT ur.organization_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  ) OR 
  public.is_admin()
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id OR public.is_admin());