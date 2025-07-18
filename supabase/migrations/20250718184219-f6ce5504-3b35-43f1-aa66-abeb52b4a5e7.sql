-- Add marketplace_channel column to inventory_items table
ALTER TABLE inventory_items 
ADD COLUMN marketplace_channel TEXT;