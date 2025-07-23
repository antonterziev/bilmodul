-- Create table for Fortnox error logging
CREATE TABLE public.fortnox_errors_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fortnox_errors_log ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own error logs" 
  ON public.fortnox_errors_log 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own error logs" 
  ON public.fortnox_errors_log 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_fortnox_errors_log_user_id ON public.fortnox_errors_log(user_id, timestamp DESC);
CREATE INDEX idx_fortnox_errors_log_type ON public.fortnox_errors_log(type, timestamp DESC);