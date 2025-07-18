-- Add brand_other column to inventory_items table for when "Annan" brand is selected
ALTER TABLE public.inventory_items 
ADD COLUMN brand_other text;