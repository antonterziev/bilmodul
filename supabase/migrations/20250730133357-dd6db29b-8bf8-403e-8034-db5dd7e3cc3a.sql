-- Add column to track who synced the vehicle with Fortnox
ALTER TABLE public.inventory_items 
ADD COLUMN fortnox_synced_by_user_id UUID REFERENCES auth.users(id);

-- Add index for better performance
CREATE INDEX idx_inventory_items_fortnox_synced_by_user_id 
ON public.inventory_items(fortnox_synced_by_user_id);

-- Add column to fortnox_sync_log to track sync performer
ALTER TABLE public.fortnox_sync_log 
ADD COLUMN synced_by_user_id UUID REFERENCES auth.users(id);

-- Add index for better performance  
CREATE INDEX idx_fortnox_sync_log_synced_by_user_id 
ON public.fortnox_sync_log(synced_by_user_id);