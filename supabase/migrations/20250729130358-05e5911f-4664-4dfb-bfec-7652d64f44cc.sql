-- Create a security definer function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Drop and recreate the problematic profiles policy without circular reference
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  is_admin() OR
  (organization_id = public.get_user_organization_id())
);