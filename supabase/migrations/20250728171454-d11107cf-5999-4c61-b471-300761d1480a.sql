-- First migration: Add superuser to the app_role enum
ALTER TYPE app_role ADD VALUE 'superuser';