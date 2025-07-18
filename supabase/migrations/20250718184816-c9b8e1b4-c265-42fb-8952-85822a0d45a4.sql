-- Add marketplace_channel_other column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN marketplace_channel_other TEXT;