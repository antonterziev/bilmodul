-- Add new roles to the app_role enum
ALTER TYPE app_role ADD VALUE 'admin';
ALTER TYPE app_role ADD VALUE 'lager';
ALTER TYPE app_role ADD VALUE 'inkop';
ALTER TYPE app_role ADD VALUE 'pakostnad';
ALTER TYPE app_role ADD VALUE 'forsaljning';