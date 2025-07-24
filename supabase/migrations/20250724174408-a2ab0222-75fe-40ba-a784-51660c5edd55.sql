-- Check which foreign key constraints already exist and add only the missing ones
-- Skip profiles table - constraint already exists

-- Add foreign key constraint to inventory_items table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'inventory_items_user_id_fkey' 
        AND table_name = 'inventory_items'
    ) THEN
        ALTER TABLE public.inventory_items 
        ADD CONSTRAINT inventory_items_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_integrations table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_integrations_user_id_fkey' 
        AND table_name = 'fortnox_integrations'
    ) THEN
        ALTER TABLE public.fortnox_integrations 
        ADD CONSTRAINT fortnox_integrations_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_sync_log table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_sync_log_user_id_fkey' 
        AND table_name = 'fortnox_sync_log'
    ) THEN
        ALTER TABLE public.fortnox_sync_log 
        ADD CONSTRAINT fortnox_sync_log_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_article_sync table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_article_sync_user_id_fkey' 
        AND table_name = 'fortnox_article_sync'
    ) THEN
        ALTER TABLE public.fortnox_article_sync 
        ADD CONSTRAINT fortnox_article_sync_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_corrections table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_corrections_user_id_fkey' 
        AND table_name = 'fortnox_corrections'
    ) THEN
        ALTER TABLE public.fortnox_corrections 
        ADD CONSTRAINT fortnox_corrections_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_errors_log table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_errors_log_user_id_fkey' 
        AND table_name = 'fortnox_errors_log'
    ) THEN
        ALTER TABLE public.fortnox_errors_log 
        ADD CONSTRAINT fortnox_errors_log_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to fortnox_oauth_states table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fortnox_oauth_states_user_id_fkey' 
        AND table_name = 'fortnox_oauth_states'
    ) THEN
        ALTER TABLE public.fortnox_oauth_states 
        ADD CONSTRAINT fortnox_oauth_states_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint to user_roles table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_roles_user_id_fkey' 
        AND table_name = 'user_roles'
    ) THEN
        ALTER TABLE public.user_roles 
        ADD CONSTRAINT user_roles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;