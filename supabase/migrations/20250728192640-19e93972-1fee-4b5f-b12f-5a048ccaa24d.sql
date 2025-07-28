-- Update anton.terziev@outlook.com from superuser to admin
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = (
  SELECT user_id 
  FROM profiles 
  WHERE email = 'anton.terziev@outlook.com'
) AND role = 'superuser';