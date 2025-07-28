-- Update the pending invitation to accepted since the user already has an account
UPDATE invitations 
SET status = 'accepted', 
    accepted_at = now(),
    updated_at = now()
WHERE email = 'tony.terziev@gmail.com' 
  AND status = 'pending';