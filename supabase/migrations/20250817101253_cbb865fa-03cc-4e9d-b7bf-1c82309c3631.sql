-- Add organization_id column to scraped_car_cache table for proper access control
ALTER TABLE public.scraped_car_cache 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create index for better performance
CREATE INDEX idx_scraped_car_cache_organization_id ON public.scraped_car_cache(organization_id);
CREATE INDEX idx_scraped_car_cache_registration_org ON public.scraped_car_cache(registration_number, organization_id);

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view cached data" ON public.scraped_car_cache;
DROP POLICY IF EXISTS "Authenticated users can insert cached data" ON public.scraped_car_cache;

-- Create new secure RLS policies
CREATE POLICY "Users can view cached data from their organization" 
ON public.scraped_car_cache 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert cached data for their organization" 
ON public.scraped_car_cache 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update cached data in their organization" 
ON public.scraped_car_cache 
FOR UPDATE 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete cached data from their organization" 
ON public.scraped_car_cache 
FOR DELETE 
USING (organization_id = get_user_organization_id());