-- Create table to store vehicle brand logos
CREATE TABLE public.brand_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL UNIQUE,
  logo_url TEXT NOT NULL,
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brand_logos ENABLE ROW LEVEL SECURITY;

-- Create policies (make logos publicly viewable)
CREATE POLICY "Brand logos are publicly viewable" 
ON public.brand_logos 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage brand logos" 
ON public.brand_logos 
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_brand_logos_updated_at
BEFORE UPDATE ON public.brand_logos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-logos', 'brand-logos', true);

-- Create storage policies
CREATE POLICY "Brand logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'brand-logos');

CREATE POLICY "Authenticated users can upload brand logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'brand-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update brand logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'brand-logos' AND auth.uid() IS NOT NULL);

-- Create index for faster brand name lookups
CREATE INDEX idx_brand_logos_brand_name ON public.brand_logos(brand_name);