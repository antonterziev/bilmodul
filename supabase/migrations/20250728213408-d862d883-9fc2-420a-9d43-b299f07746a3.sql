-- Add CASCADE DELETE to user_id foreign keys to allow proper user cleanup

-- Drop existing foreign key constraints and recreate with CASCADE DELETE
-- This will ensure that when a user is deleted, all their related data is automatically cleaned up

-- Update inventory_items table
ALTER TABLE public.inventory_items 
DROP CONSTRAINT IF EXISTS inventory_items_user_id_fkey;

ALTER TABLE public.inventory_items 
ADD CONSTRAINT inventory_items_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update profiles table
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update user_roles table
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_integrations table
ALTER TABLE public.fortnox_integrations 
DROP CONSTRAINT IF EXISTS fortnox_integrations_user_id_fkey;

ALTER TABLE public.fortnox_integrations 
ADD CONSTRAINT fortnox_integrations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_oauth_states table
ALTER TABLE public.fortnox_oauth_states 
DROP CONSTRAINT IF EXISTS fortnox_oauth_states_user_id_fkey;

ALTER TABLE public.fortnox_oauth_states 
ADD CONSTRAINT fortnox_oauth_states_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_sync_log table
ALTER TABLE public.fortnox_sync_log 
DROP CONSTRAINT IF EXISTS fortnox_sync_log_user_id_fkey;

ALTER TABLE public.fortnox_sync_log 
ADD CONSTRAINT fortnox_sync_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_article_sync table
ALTER TABLE public.fortnox_article_sync 
DROP CONSTRAINT IF EXISTS fortnox_article_sync_user_id_fkey;

ALTER TABLE public.fortnox_article_sync 
ADD CONSTRAINT fortnox_article_sync_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_corrections table
ALTER TABLE public.fortnox_corrections 
DROP CONSTRAINT IF EXISTS fortnox_corrections_user_id_fkey;

ALTER TABLE public.fortnox_corrections 
ADD CONSTRAINT fortnox_corrections_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update fortnox_errors_log table
ALTER TABLE public.fortnox_errors_log 
DROP CONSTRAINT IF EXISTS fortnox_errors_log_user_id_fkey;

ALTER TABLE public.fortnox_errors_log 
ADD CONSTRAINT fortnox_errors_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;