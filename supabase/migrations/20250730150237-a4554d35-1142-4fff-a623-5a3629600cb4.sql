-- Create table for storing user-configured account mappings
CREATE TABLE public.account_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one mapping per account name per organization
  UNIQUE(organization_id, account_name)
);

-- Enable Row Level Security
ALTER TABLE public.account_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for account mappings
CREATE POLICY "Users can view account mappings in their organization" 
ON public.account_mappings 
FOR SELECT 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create account mappings in their organization" 
ON public.account_mappings 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() = user_id);

CREATE POLICY "Users can update account mappings in their organization" 
ON public.account_mappings 
FOR UPDATE 
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete account mappings in their organization" 
ON public.account_mappings 
FOR DELETE 
USING (organization_id = get_user_organization_id());

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_account_mappings_updated_at
BEFORE UPDATE ON public.account_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();