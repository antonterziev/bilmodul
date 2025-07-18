-- Add logistics tracking fields to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN current_location TEXT DEFAULT 'Täby',
ADD COLUMN additional_costs DECIMAL(10,2) DEFAULT 0,
ADD COLUMN logistics_documentation_attached BOOLEAN DEFAULT false,
ADD COLUMN logistics_notes TEXT;