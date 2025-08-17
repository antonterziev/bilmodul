import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Standard error response with stable codes
export function errorResponse(message: string, code: string, status: number = 400) {
  return new Response(
    JSON.stringify({ 
      error: message, 
      code,
      timestamp: new Date().toISOString() 
    }),
    { 
      status, 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json' 
      } 
    }
  );
}

// Rate limiting using simple in-memory store (could be replaced with Redis/KV)
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

export function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now - record.lastReset > windowMs) {
    rateLimitStore.set(key, { count: 1, lastReset: now });
    return true;
  }
  
  if (record.count >= limit) {
    return false;
  }
  
  record.count++;
  return true;
}

// Organization membership verification
export async function verifyOrgMembership(
  supabase: any,
  userId: string,
  requiredOrgId?: string
): Promise<{ success: boolean; orgId?: string; error?: string }> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', userId)
    .single();
    
  if (error || !profile) {
    return { success: false, error: 'User profile not found' };
  }
  
  if (requiredOrgId && profile.organization_id !== requiredOrgId) {
    return { success: false, error: 'Organization access denied' };
  }
  
  return { success: true, orgId: profile.organization_id };
}

// Authentication helper
export async function authenticateUser(req: Request): Promise<{ user: any; supabase: any } | Response> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return errorResponse('Unauthorized', 'AUTH_ERROR', 401);
  }

  return { user, supabase };
}

// Structured logging
export function logError(
  functionName: string,
  userId: string,
  message: string,
  context: Record<string, any> = {}
) {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    function: functionName,
    userId,
    message,
    context
  }));
}

export function logInfo(
  functionName: string,
  userId: string,
  message: string,
  context: Record<string, any> = {}
) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    function: functionName,
    userId,
    message,
    context
  }));
}