-- Fix inventory_items RLS policies to use the security definer function
DROP POLICY IF EXISTS "Users can view inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can create inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update inventory items in their organization" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can delete inventory items in their organization" ON public.inventory_items;

-- Recreate policies using the security definer function
CREATE POLICY "Users can view inventory items in their organization"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create inventory items in their organization"
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND (organization_id = public.get_user_organization_id()));

CREATE POLICY "Users can update inventory items in their organization"
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete inventory items in their organization"
ON public.inventory_items
FOR DELETE
TO authenticated
USING (organization_id = public.get_user_organization_id());