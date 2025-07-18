-- Add purchase_channel_other column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN purchase_channel_other TEXT;