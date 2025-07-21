-- Create dedicated table for OAuth state management
CREATE TABLE public.fortnox_oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_fortnox_oauth_states_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add Row Level Security
ALTER TABLE public.fortnox_oauth_states ENABLE ROW LEVEL SECURITY;

-- Create policies for OAuth states
CREATE POLICY "Users can view their own OAuth states" 
  ON public.fortnox_oauth_states 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own OAuth states" 
  ON public.fortnox_oauth_states 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth states" 
  ON public.fortnox_oauth_states 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth states" 
  ON public.fortnox_oauth_states 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for faster state lookups
CREATE INDEX idx_fortnox_oauth_states_state ON public.fortnox_oauth_states(state);
CREATE INDEX idx_fortnox_oauth_states_created_at ON public.fortnox_oauth_states(created_at);

-- Function to cleanup old OAuth states (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_oauth_states()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.fortnox_oauth_states 
  WHERE created_at < (now() - interval '10 minutes');
END;
$$;