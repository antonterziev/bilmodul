-- Add missing columns to inventory_items table for Fortnox integration
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS fortnox_project_number text,
ADD COLUMN IF NOT EXISTS fortnox_invoice_number text;