-- Add new roles to the app_role enum
ALTER TYPE app_role ADD VALUE 'admin';
ALTER TYPE app_role ADD VALUE 'lager';
ALTER TYPE app_role ADD VALUE 'inkop';
ALTER TYPE app_role ADD VALUE 'pakostnad';
ALTER TYPE app_role ADD VALUE 'forsaljning';

-- Update existing roles to match new naming
UPDATE user_roles SET role = 'admin' WHERE role = 'administrator';
UPDATE user_roles SET role = 'ekonomi' WHERE role = 'ekonomi';

-- Keep superuser as is since it's a system role