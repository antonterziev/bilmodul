-- Remove lagervaerde column and related functions/triggers with CASCADE
-- Drop the trigger with CASCADE to remove dependencies
DROP TRIGGER IF EXISTS trigger_update_lagervaerde ON public.inventory_items CASCADE;

-- Drop the function
DROP FUNCTION IF EXISTS public.calculate_lagervaerde(text, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.update_lagervaerde() CASCADE;

-- Remove the lagervaerde column
ALTER TABLE public.inventory_items DROP COLUMN IF EXISTS lagervaerde;