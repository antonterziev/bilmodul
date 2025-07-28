-- Remove the unique constraint on user_id from user_roles to allow multiple roles per user
-- First, let's see the current structure and remove any unique constraints
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;

-- Create a unique constraint on user_id, role, organization_id combination instead
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_role_org_unique 
UNIQUE (user_id, role, organization_id);