-- Create a function to check if removing an admin role would leave organization without admins
CREATE OR REPLACE FUNCTION public.can_remove_admin_role(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (
    SELECT COUNT(*) 
    FROM public.user_roles 
    WHERE role = 'admin' 
    AND organization_id = _organization_id
    AND user_id != _user_id
  ) > 0
$$;

-- Create a function to prevent removing the last admin from an organization
CREATE OR REPLACE FUNCTION public.validate_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If deleting an admin role, check if it's the last one in the organization
  IF OLD.role = 'admin' THEN
    IF NOT public.can_remove_admin_role(OLD.user_id, OLD.organization_id) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization';
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$;

-- Create trigger to validate admin removal
DROP TRIGGER IF EXISTS validate_admin_removal_trigger ON public.user_roles;
CREATE TRIGGER validate_admin_removal_trigger
  BEFORE DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_admin_removal();