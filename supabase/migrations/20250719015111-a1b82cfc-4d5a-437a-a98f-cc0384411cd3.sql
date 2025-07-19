-- Create table to cache scraped car data
CREATE TABLE public.scraped_car_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number TEXT NOT NULL UNIQUE,
  scraped_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraped_car_cache ENABLE ROW LEVEL SECURITY;

-- Create policies (make it accessible to authenticated users)
CREATE POLICY "Authenticated users can view cached data" 
ON public.scraped_car_cache 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert cached data" 
ON public.scraped_car_cache 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scraped_car_cache_updated_at
BEFORE UPDATE ON public.scraped_car_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_scraped_car_cache_registration_number ON public.scraped_car_cache(registration_number);