-- Fix the security warning by setting search_path for the function
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
DECLARE
    user_email text;
BEGIN
    -- Get the user's email from the new profile
    user_email := NEW.email;
    
    -- Update any pending invitations for this email to accepted
    UPDATE public.invitations 
    SET 
        status = 'accepted',
        accepted_at = now(),
        updated_at = now()
    WHERE 
        email = user_email 
        AND status = 'pending' 
        AND expires_at > now();
    
    RETURN NEW;
END;
$$;