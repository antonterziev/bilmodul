-- Phase 1 Security Enhancement: Add encrypted credentials storage
-- Create encrypted storage for Fortnox credentials using Supabase Vault

-- Add encrypted_credentials column to fortnox_integrations table
ALTER TABLE public.fortnox_integrations 
ADD COLUMN encrypted_access_token TEXT,
ADD COLUMN encrypted_refresh_token TEXT,
ADD COLUMN encryption_key_id UUID;

-- Create audit log table for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type TEXT NOT NULL,
    event_description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on security audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (is_admin());

-- Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_event_description TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.security_audit_log (
        user_id,
        event_type,
        event_description,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_user_id,
        p_event_type,
        p_event_description,
        p_ip_address,
        p_user_agent,
        p_metadata
    );
END;
$$;

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    ip_address TEXT,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own rate limits
CREATE POLICY "Users can manage their own rate limits"
ON public.rate_limits
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id UUID,
    p_ip_address TEXT,
    p_endpoint TEXT,
    p_limit INTEGER DEFAULT 10,
    p_window_minutes INTEGER DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count INTEGER;
    window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate window start time
    window_start_time := now() - (p_window_minutes || ' minutes')::interval;
    
    -- Clean up old rate limit records
    DELETE FROM public.rate_limits 
    WHERE window_start < window_start_time;
    
    -- Check current count for this user/IP/endpoint combination
    SELECT COALESCE(SUM(request_count), 0)
    INTO current_count
    FROM public.rate_limits
    WHERE (user_id = p_user_id OR ip_address = p_ip_address)
    AND endpoint = p_endpoint
    AND window_start >= window_start_time;
    
    -- If limit exceeded, return false
    IF current_count >= p_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Otherwise, increment count and return true
    INSERT INTO public.rate_limits (user_id, ip_address, endpoint, request_count, window_start)
    VALUES (p_user_id, p_ip_address, p_endpoint, 1, now())
    ON CONFLICT (user_id, ip_address, endpoint) 
    DO UPDATE SET 
        request_count = rate_limits.request_count + 1,
        updated_at = now();
    
    RETURN TRUE;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON public.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON public.security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);