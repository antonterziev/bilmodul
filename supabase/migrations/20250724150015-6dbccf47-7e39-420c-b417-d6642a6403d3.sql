-- Update cleanup_old_oauth_states function to include explicit search_path for security
CREATE OR REPLACE FUNCTION public.cleanup_old_oauth_states()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.fortnox_oauth_states 
  WHERE created_at < (now() - interval '10 minutes');
END;
$function$;