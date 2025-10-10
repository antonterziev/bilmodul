-- =====================================================
-- PHASE 1: CRITICAL SECURITY FIXES FOR ADMIN SYSTEM
-- =====================================================

-- 1. DROP THE DANGEROUS SELF-SERVICE PERMISSION POLICY
-- This policy allows users to grant themselves ANY permission including admin
DROP POLICY IF EXISTS "Users can manage their own permissions" ON public.user_permissions;

-- 2. CREATE SECURE ADMIN-ONLY PERMISSION MANAGEMENT FUNCTION
CREATE OR REPLACE FUNCTION public.assign_user_permission(
  target_user_id uuid,
  new_permission app_permission,
  target_org_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  target_user_org uuid;
BEGIN
  -- Check if caller is admin
  caller_is_admin := public.is_admin(auth.uid());
  
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Only admins can assign permissions';
  END IF;
  
  -- Get target user's organization
  SELECT organization_id INTO target_user_org
  FROM public.profiles
  WHERE user_id = target_user_id;
  
  -- Prevent removing last admin (if removing admin permission)
  IF new_permission = 'admin' THEN
    -- Check if this would be removing the last admin
    IF NOT public.can_remove_admin_permission(target_user_id, target_user_org) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization';
    END IF;
  END IF;
  
  -- Insert the permission
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES (target_user_id, new_permission)
  ON CONFLICT (user_id, permission) DO NOTHING;
  
  -- Log the action
  PERFORM public.log_security_event(
    auth.uid(),
    'permission_assigned',
    format('Assigned %s permission to user %s', new_permission, target_user_id),
    NULL,
    NULL,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'permission', new_permission,
      'organization_id', target_user_org
    )
  );
  
  RETURN true;
END;
$$;

-- 3. CREATE SECURE PERMISSION REMOVAL FUNCTION
CREATE OR REPLACE FUNCTION public.revoke_user_permission(
  target_user_id uuid,
  permission_to_revoke app_permission
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
  target_user_org uuid;
BEGIN
  -- Check if caller is admin
  caller_is_admin := public.is_admin(auth.uid());
  
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Only admins can revoke permissions';
  END IF;
  
  -- Get target user's organization
  SELECT organization_id INTO target_user_org
  FROM public.profiles
  WHERE user_id = target_user_id;
  
  -- Prevent removing last admin
  IF permission_to_revoke = 'admin' THEN
    IF NOT public.can_remove_admin_permission(target_user_id, target_user_org) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization';
    END IF;
  END IF;
  
  -- Delete the permission
  DELETE FROM public.user_permissions
  WHERE user_id = target_user_id
    AND permission = permission_to_revoke;
  
  -- Log the action
  PERFORM public.log_security_event(
    auth.uid(),
    'permission_revoked',
    format('Revoked %s permission from user %s', permission_to_revoke, target_user_id),
    NULL,
    NULL,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'permission', permission_to_revoke,
      'organization_id', target_user_org
    )
  );
  
  RETURN true;
END;
$$;

-- 4. CREATE ADMIN RPC FOR LISTING USERS (with proper access control)
CREATE OR REPLACE FUNCTION public.admin_list_users(
  filter_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  organization_id uuid,
  organization_name text,
  permissions text[],
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.user_id,
    p.email,
    p.first_name,
    p.last_name,
    p.organization_id,
    o.name as organization_name,
    COALESCE(ARRAY_AGG(up.permission::text) FILTER (WHERE up.permission IS NOT NULL), ARRAY[]::text[]) as permissions,
    p.created_at,
    au.last_sign_in_at
  FROM public.profiles p
  LEFT JOIN public.organizations o ON p.organization_id = o.id
  LEFT JOIN public.user_permissions up ON p.user_id = up.user_id
  LEFT JOIN auth.users au ON p.user_id = au.id
  WHERE filter_org_id IS NULL OR p.organization_id = filter_org_id
  GROUP BY p.user_id, p.email, p.first_name, p.last_name, p.organization_id, o.name, p.created_at, au.last_sign_in_at
  ORDER BY p.created_at DESC;
END;
$$;

-- 5. CREATE ADMIN RPC FOR LISTING INVITATIONS
CREATE OR REPLACE FUNCTION public.admin_list_invitations(
  filter_org_id uuid DEFAULT NULL,
  filter_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  permissions text[],
  status text,
  invited_by_email text,
  created_at timestamptz,
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.organization_id,
    o.name as organization_name,
    i.permissions,
    i.status,
    p.email as invited_by_email,
    i.created_at,
    i.expires_at,
    i.accepted_at
  FROM public.invitations i
  LEFT JOIN public.organizations o ON i.organization_id = o.id
  LEFT JOIN public.profiles p ON i.invited_by_user_id = p.user_id
  WHERE (filter_org_id IS NULL OR i.organization_id = filter_org_id)
    AND (filter_status IS NULL OR i.status = filter_status)
  ORDER BY i.created_at DESC;
END;
$$;

-- 6. CREATE ADMIN RPC FOR DELETING USERS (with proper safeguards)
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id uuid,
  reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email text;
  target_org uuid;
  caller_user_id uuid;
BEGIN
  caller_user_id := auth.uid();
  
  -- Check if caller is admin
  IF NOT public.is_admin(caller_user_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Prevent self-deletion
  IF target_user_id = caller_user_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Get target user info
  SELECT email, organization_id INTO target_email, target_org
  FROM public.profiles
  WHERE user_id = target_user_id;
  
  -- Check if target is last admin
  IF public.has_permission(target_user_id, 'admin') THEN
    IF NOT public.can_remove_admin_permission(target_user_id, target_org) THEN
      RAISE EXCEPTION 'Cannot delete the last admin from organization';
    END IF;
  END IF;
  
  -- Log the deletion BEFORE deleting (so we have the info)
  PERFORM public.log_security_event(
    caller_user_id,
    'user_deleted',
    format('Deleted user %s (%s)', target_email, target_user_id),
    NULL,
    NULL,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'target_email', target_email,
      'organization_id', target_org,
      'reason', reason
    )
  );
  
  -- Delete user permissions first (due to foreign key)
  DELETE FROM public.user_permissions WHERE user_id = target_user_id;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  
  -- Note: We're NOT deleting from auth.users - that should be done via edge function
  -- with service role to properly clean up auth data
  
  RETURN true;
END;
$$;

-- 7. UPDATE TRIGGER TO PREVENT LAST ADMIN REMOVAL ON UPDATE
CREATE OR REPLACE FUNCTION public.validate_admin_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get user's organization from profiles
  SELECT organization_id INTO user_org_id 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;
  
  -- If updating an admin permission, check if it's the last one
  IF NEW.permission = 'admin' AND OLD.permission = 'admin' THEN
    IF NOT public.can_remove_admin_permission(NEW.user_id, user_org_id) THEN
      RAISE EXCEPTION 'Cannot remove the last admin from organization';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for updates
DROP TRIGGER IF EXISTS validate_admin_permission_update ON public.user_permissions;
CREATE TRIGGER validate_admin_permission_update
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_admin_update();

-- 8. TIGHTEN RLS POLICIES ON USER_PERMISSIONS
-- Users can only view their own permissions
-- Admins can view and manage all permissions via RPCs only

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;

-- Create new restrictive policies
CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- NO INSERT/UPDATE/DELETE policies for users - they must use RPCs
-- This prevents privilege escalation

-- 9. ADD INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON public.invitations(organization_id);