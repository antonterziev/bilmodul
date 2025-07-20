-- Create Fortnox integration table
CREATE TABLE public.fortnox_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  company_name TEXT,
  fortnox_company_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fortnox_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own fortnox integrations" 
  ON public.fortnox_integrations 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fortnox integrations" 
  ON public.fortnox_integrations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fortnox integrations" 
  ON public.fortnox_integrations 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fortnox integrations" 
  ON public.fortnox_integrations 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fortnox_integrations_updated_at
  BEFORE UPDATE ON public.fortnox_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create table to track synced articles
CREATE TABLE public.fortnox_article_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  fortnox_article_number TEXT NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for article sync table
ALTER TABLE public.fortnox_article_sync ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for article sync
CREATE POLICY "Users can view their own article syncs" 
  ON public.fortnox_article_sync 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own article syncs" 
  ON public.fortnox_article_sync 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own article syncs" 
  ON public.fortnox_article_sync 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own article syncs" 
  ON public.fortnox_article_sync 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_fortnox_article_sync_updated_at
  BEFORE UPDATE ON public.fortnox_article_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();