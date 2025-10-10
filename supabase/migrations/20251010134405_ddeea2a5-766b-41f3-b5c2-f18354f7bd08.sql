-- Fix rate_limits RLS policy to prevent NULL user_id access
DROP POLICY IF EXISTS "Users can manage their own rate limits" ON public.rate_limits;

CREATE POLICY "Users can manage their own rate limits"
ON public.rate_limits
FOR ALL
USING (auth.uid() = user_id);

-- Add a separate policy for service role to manage NULL user_id entries
CREATE POLICY "Service role can manage all rate limits"
ON public.rate_limits
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');