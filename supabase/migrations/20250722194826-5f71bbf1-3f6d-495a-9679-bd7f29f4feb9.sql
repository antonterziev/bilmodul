-- Add Fortnox sync tracking to inventory items
ALTER TABLE public.inventory_items 
ADD COLUMN fortnox_verification_number TEXT,
ADD COLUMN fortnox_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN fortnox_sync_status TEXT DEFAULT 'pending' CHECK (fortnox_sync_status IN ('pending', 'synced', 'failed', 'skipped'));

-- Create index for better performance
CREATE INDEX idx_inventory_items_fortnox_sync ON public.inventory_items(fortnox_sync_status, fortnox_synced_at);

-- Create table to track Fortnox sync attempts and errors
CREATE TABLE public.fortnox_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL, -- 'purchase', 'sale', etc.
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending', 'success', 'failed')),
  fortnox_verification_number TEXT,
  error_message TEXT,
  sync_data JSONB, -- Store the data sent to Fortnox
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sync log
ALTER TABLE public.fortnox_sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies for sync log
CREATE POLICY "Users can view their own sync logs" 
  ON public.fortnox_sync_log 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync logs" 
  ON public.fortnox_sync_log 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync logs" 
  ON public.fortnox_sync_log 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_fortnox_sync_log_item_id ON public.fortnox_sync_log(inventory_item_id);
CREATE INDEX idx_fortnox_sync_log_status ON public.fortnox_sync_log(sync_status, created_at);