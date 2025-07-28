-- Update the invitation status for tony.terziev@gmail.com to accepted
UPDATE invitations 
SET status = 'accepted', 
    accepted_at = now(),
    updated_at = now()
WHERE email = 'tony.terziev@gmail.com' 
  AND status = 'pending';