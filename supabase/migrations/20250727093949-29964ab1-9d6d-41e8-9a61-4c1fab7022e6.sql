-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Insert the default organization
INSERT INTO public.organizations (name) VALUES ('Veksla Bilhandel');

-- Drop existing policies and functions that depend on the old enum
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.get_current_user_role();

-- Update the app_role enum to include the new roles
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('administrator', 'bilhandel', 'ekonomi');

-- Update user_roles table to use new enum and add organization context
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING 
  CASE 
    WHEN role::text = 'admin' THEN 'administrator'::public.app_role
    WHEN role::text = 'moderator' THEN 'bilhandel'::public.app_role
    ELSE 'bilhandel'::public.app_role
  END;

-- Add organization_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update existing user_roles to use the default organization
UPDATE public.user_roles SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1);

-- Make organization_id NOT NULL now that all records have been updated
ALTER TABLE public.user_roles ALTER COLUMN organization_id SET NOT NULL;

-- Update unique constraint to include organization
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_organization_key UNIQUE (user_id, role, organization_id);

-- Drop the old enum
DROP TYPE public.app_role_old CASCADE;

-- Recreate the has_role function with new enum and organization context
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _organization_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_organization_id IS NULL OR organization_id = _organization_id)
  )
$$;

-- Recreate get_current_user_role function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = auth.uid()
  LIMIT 1
$$;

-- Add organization_id to profiles table
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update existing profiles to use the default organization
UPDATE public.profiles SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1);

-- Make organization_id NOT NULL for profiles
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;

-- Add organization_id to inventory_items table
ALTER TABLE public.inventory_items ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update existing inventory_items to use the default organization
UPDATE public.inventory_items SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1);

-- Make organization_id NOT NULL for inventory_items
ALTER TABLE public.inventory_items ALTER COLUMN organization_id SET NOT NULL;

-- Add organization_id to fortnox_integrations table
ALTER TABLE public.fortnox_integrations ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Update existing fortnox_integrations to use the default organization
UPDATE public.fortnox_integrations SET organization_id = (SELECT id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1);

-- Make organization_id NOT NULL for fortnox_integrations
ALTER TABLE public.fortnox_integrations ALTER COLUMN organization_id SET NOT NULL;

-- Create organization-aware RLS policies for organizations table
CREATE POLICY "Users can view their organization" 
ON public.organizations 
FOR SELECT 
USING (
  id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Administrators can manage organizations" 
ON public.organizations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'administrator'::app_role 
    AND organization_id = organizations.id
  )
);

-- Update inventory_items RLS policies to include organization context
DROP POLICY IF EXISTS "Users can view their own inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can create their own inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update their own inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can delete their own inventory items" ON public.inventory_items;

CREATE POLICY "Users can view inventory items in their organization" 
ON public.inventory_items 
FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create inventory items in their organization" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update inventory items in their organization" 
ON public.inventory_items 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete inventory items in their organization" 
ON public.inventory_items 
FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

-- Update profiles RLS policies to include organization context
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- Update user_roles RLS policies to include organization context
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Administrators can view roles in their organization" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'administrator'::app_role) AND
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'administrator'::app_role
  )
);

CREATE POLICY "Administrators can manage roles in their organization" 
ON public.user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'administrator'::app_role) AND
  organization_id IN (
    SELECT organization_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'administrator'::app_role
  )
);

-- Update handle_new_user function to assign organization and default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  default_org_id uuid;
BEGIN
  -- Get the default organization
  SELECT id INTO default_org_id FROM public.organizations WHERE name = 'Veksla Bilhandel' LIMIT 1;
  
  -- Create profile
  INSERT INTO public.profiles (user_id, email, full_name, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    default_org_id
  );
  
  -- Assign default 'bilhandel' role to new users
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, 'bilhandel', default_org_id);
  
  RETURN NEW;
END;
$$;