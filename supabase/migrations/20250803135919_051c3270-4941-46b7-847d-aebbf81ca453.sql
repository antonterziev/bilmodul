-- Remove lagervaerde column and related functions/triggers
-- Drop the trigger first
DROP TRIGGER IF EXISTS update_lagervaerde_trigger ON public.inventory_items;

-- Drop the function
DROP FUNCTION IF EXISTS public.calculate_lagervaerde(text, numeric);
DROP FUNCTION IF EXISTS public.update_lagervaerde();

-- Remove the lagervaerde column
ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS lagervaerde;