-- Update profiles table RLS policy to allow administrators and superusers to update user organizations
CREATE POLICY "Administrators and superusers can update user profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (get_current_user_role() = 'administrator'::app_role) OR 
  (get_current_user_role() = 'superuser'::app_role)
);