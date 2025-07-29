-- Add trigger function to automatically mark invitations as accepted when user signs up
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run when profile is inserted (user signs up)
CREATE TRIGGER on_profile_created_accept_invitation
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_invitation_acceptance();

-- Mark existing invitations for registered users as accepted
UPDATE public.invitations 
SET 
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
WHERE 
    email IN (SELECT email FROM public.profiles WHERE email IS NOT NULL)
    AND status = 'pending';