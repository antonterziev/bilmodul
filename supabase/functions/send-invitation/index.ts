import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  permissions: string[]; // Changed from roles to permissions
  organizationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send invitation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Get request data
    const { email, permissions, organizationId }: InvitationRequest = await req.json();
    console.log("Invitation request:", { email, permissions, organizationId });

    // Get the authorization header to identify the current user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the user is authenticated and get their info
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Authentication failed");
    }

    console.log("Authenticated user:", user.id);

    // Check if user has admin permission
    const { data: userPermissions, error: permissionError } = await supabase
      .from("user_permissions")
      .select("permission")
      .eq("user_id", user.id);

    if (permissionError) {
      throw new Error("Failed to check user permissions");
    }

    const hasAdminPermission = userPermissions?.some(p => p.permission === "admin");
    if (!hasAdminPermission) {
      throw new Error("Insufficient permissions");
    }

    // Get organization details
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    if (orgError || !organization) {
      throw new Error("Organization not found");
    }

    // Check if user already exists in the system
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("user_id, organization_id")
      .eq("email", email)
      .eq("organization_id", organizationId)
      .single();

    if (existingUser) {
      throw new Error("Användaren finns redan i organisationen");
    }

    // Check if invitation already exists (any status)
    const { data: existingInvitation } = await supabase
      .from("invitations")
      .select("id, status")
      .eq("email", email)
      .eq("organization_id", organizationId)
      .single();

    if (existingInvitation) {
      if (existingInvitation.status === "accepted") {
        // User has already accepted an invitation, they're already in the system
        throw new Error("Användaren har redan ett konto i organisationen");
      } else {
        // Update existing pending invitation
        const { error: updateError } = await supabase
          .from("invitations")
          .update({
            permissions, // Use permissions array instead of roles
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            status: "pending", // Reset to pending in case it was expired
          })
          .eq("id", existingInvitation.id);

        if (updateError) {
          throw new Error("Failed to update invitation");
        }
        console.log("Updated existing invitation");
      }
    } else {
      // Create new invitation
      const { error: insertError } = await supabase
        .from("invitations")
        .insert({
          email,
          organization_id: organizationId,
          invited_by_user_id: user.id,
          permissions, // Use permissions array instead of roles
        });

      if (insertError) {
        throw new Error("Failed to create invitation: " + insertError.message);
      }
      console.log("Created new invitation");
    }

    // Send invitation email
    const inviteUrl = `https://lagermodulen.se/onboarding?invite=true&email=${encodeURIComponent(email)}`;
    
    // Format permissions for email
    const permissionDisplayNames: Record<string, string> = {
      'admin': 'Admin',
      'lager': 'Lager', 
      'ekonomi': 'Ekonomi',
      'inkop': 'Inköp',
      'pakostnad': 'Påkostnad',
      'forsaljning': 'Försäljning'
    };
    const formattedPermissions = permissions.map(permission => permissionDisplayNames[permission] || permission).join(', ');
    
    const emailResponse = await resend.emails.send({
      from: "Veksla Bilhandel <noreply@lagermodulen.se>",
      to: [email],
      subject: `Inbjudan till ${organization.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Du har blivit inbjuden!</h1>
          <p>Du har blivit inbjuden att gå med i <strong>${organization.name}</strong> med behörigheterna <strong>${formattedPermissions}</strong>.</p>
          <p>Klicka på länken nedan för att skapa ditt konto och gå med i organisationen:</p>
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">Acceptera inbjudan</a>
          <p style="color: #666; font-size: 14px;">Denna inbjudan är giltig i 7 dagar.</p>
          <p style="color: #666; font-size: 14px;">Om du inte förväntade dig denna inbjudan kan du ignorera detta mail.</p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Invitation sent successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
};

serve(handler);