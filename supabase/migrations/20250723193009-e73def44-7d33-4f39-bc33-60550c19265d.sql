-- Create table to track Fortnox corrections/cancellations
CREATE TABLE public.fortnox_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  original_series TEXT NOT NULL,
  original_number TEXT NOT NULL,
  correction_series TEXT NOT NULL,
  correction_number TEXT NOT NULL,
  correction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fortnox_corrections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own corrections" 
  ON public.fortnox_corrections 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own corrections" 
  ON public.fortnox_corrections 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_fortnox_corrections_user_id ON public.fortnox_corrections(user_id);
CREATE INDEX idx_fortnox_corrections_original ON public.fortnox_corrections(original_series, original_number);