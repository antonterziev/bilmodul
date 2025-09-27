import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Input validation schemas
export const fortnoxRequestSchema = z.object({
  inventoryItemId: z.string().uuid(),
  syncingUserId: z.string().uuid().optional(),
});

export const accountCheckSchema = z.object({
  accountNumber: z.string().min(1),
  userId: z.string().uuid(),
});

export const correctionSchema = z.object({
  series: z.string().min(1),
  number: z.string().min(1),
  userId: z.string().uuid(),
  correctionSeries: z.string().default('A'),
  correctionDate: z.string().optional(),
  registrationNumber: z.string().optional(),
});

// Safe error message extraction
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// Safe error stack extraction
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

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

// Create Supabase client safely
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}