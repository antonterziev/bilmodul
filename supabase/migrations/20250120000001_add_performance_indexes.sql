
-- Add composite indexes for common query patterns to improve performance
-- These indexes will speed up existing queries without changing any functionality

-- Index for filtering vehicles by user, status, and purchase date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_status_date 
ON inventory_items(user_id, status, purchase_date DESC);

-- Index for user's vehicles ordered by creation date (dashboard queries)
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_created 
ON inventory_items(user_id, created_at DESC);

-- Index for brand logo lookups (case-insensitive brand name searches)
CREATE INDEX IF NOT EXISTS idx_brand_logos_brand_name_lower 
ON brand_logos(lower(brand_name));

-- Index for registration number lookups in scraped cache
CREATE INDEX IF NOT EXISTS idx_scraped_car_cache_reg_updated 
ON scraped_car_cache(registration_number, updated_at DESC);
