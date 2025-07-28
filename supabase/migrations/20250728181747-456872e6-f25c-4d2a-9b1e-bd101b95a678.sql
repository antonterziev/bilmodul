-- Fix the get_current_user_role function to handle superuser properly
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  -- First check if user is a superuser, then administrator, then return any role
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superuser'::app_role) THEN 'superuser'::app_role
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'administrator'::app_role) THEN 'administrator'::app_role
      ELSE (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
    END
$$;