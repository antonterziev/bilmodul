-- Remove the accepted invitation for tony.terziev@gmail.com to allow new invitations
DELETE FROM invitations 
WHERE email = 'tony.terziev@gmail.com' 
  AND status = 'accepted';