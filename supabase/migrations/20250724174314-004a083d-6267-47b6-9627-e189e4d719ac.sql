-- Add foreign key constraints with CASCADE DELETE to ensure automatic cleanup when users are deleted

-- Add foreign key constraint to profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to inventory_items table  
ALTER TABLE public.inventory_items 
ADD CONSTRAINT inventory_items_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_integrations table
ALTER TABLE public.fortnox_integrations 
ADD CONSTRAINT fortnox_integrations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_sync_log table
ALTER TABLE public.fortnox_sync_log 
ADD CONSTRAINT fortnox_sync_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_article_sync table
ALTER TABLE public.fortnox_article_sync 
ADD CONSTRAINT fortnox_article_sync_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_corrections table
ALTER TABLE public.fortnox_corrections 
ADD CONSTRAINT fortnox_corrections_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_errors_log table
ALTER TABLE public.fortnox_errors_log 
ADD CONSTRAINT fortnox_errors_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to fortnox_oauth_states table
ALTER TABLE public.fortnox_oauth_states 
ADD CONSTRAINT fortnox_oauth_states_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign key constraint to user_roles table
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;