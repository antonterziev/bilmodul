-- Assign admin role to the user who should be admin
INSERT INTO public.user_roles (user_id, role, organization_id)
VALUES ('8b3b5cbd-4320-4dce-bd70-5526a0db40de', 'admin', 'aa687c33-bff8-49f7-9c11-5092f5f9104d')
ON CONFLICT (user_id, role, organization_id) DO NOTHING;