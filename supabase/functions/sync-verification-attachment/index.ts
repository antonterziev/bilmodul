import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const inventoryItemId = formData.get("inventoryItemId") as string;

    if (!file || !inventoryItemId) {
      console.error("❌ Missing file or inventoryItemId");
      return new Response("Missing file or inventoryItemId", { status: 400, headers: corsHeaders });
    }

    console.log(`📦 Starting attachment sync for inventoryItemId: ${inventoryItemId}`);

    // 🔎 Hämta verifikationsinfo från Supabase
    const { data: item, error: fetchError } = await supabase
      .from("inventory_items")
      .select("fortnox_verification_number")
      .eq("id", inventoryItemId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !item || !item.fortnox_verification_number) {
      console.error("❌ Could not find voucher info", fetchError);
      return new Response("No voucher found for item", { status: 404, headers: corsHeaders });
    }

    const voucherNumber = item.fortnox_verification_number;
    const voucherSeries = "A"; // Default series
    const voucherYear = new Date().getFullYear();
    
    console.log(`🔗 Found voucher: ${voucherSeries}-${voucherNumber}-${voucherYear}`);

    // Get Fortnox credentials
    const { data: integrations, error: integrationError } = await supabase
      .from('fortnox_integrations')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (integrationError || !integrations || integrations.length === 0) {
      throw new Error('No active Fortnox integration found.');
    }

    const accessToken = integrations[0].access_token;
    const clientSecret = Deno.env.get("FORTNOX_CLIENT_SECRET")!;

    // 📤 1. Ladda upp fil till inbox
    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);

    const inboxUploadRes = await fetch("https://api.fortnox.se/3/inbox", {
      method: "POST",
      headers: {
        "Client-Secret": clientSecret,
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
      body: uploadForm,
    });

    const inboxJson = await inboxUploadRes.json();
    const fileId = inboxJson?.InboxFile?.Id;

    if (!fileId) {
      console.error("❌ Upload to Fortnox failed:", inboxJson);
      return new Response("Failed to upload file to Fortnox", { status: 500, headers: corsHeaders });
    }

    console.log(`✅ Uploaded file to inbox. FileId: ${fileId}`);

    // 🔗 2. Koppla filen till verifikationen
    const connectionRes = await fetch("https://api.fortnox.se/3/voucherfileconnections", {
      method: "POST",
      headers: {
        "Client-Secret": clientSecret,
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        VoucherFileConnection: {
          FileId: fileId,
          VoucherSeries: voucherSeries,
          VoucherNumber: parseInt(voucherNumber),
          VoucherYear: voucherYear,
        },
      }),
    });

    const connectionJson = await connectionRes.json();

    if (!connectionRes.ok) {
      console.error("❌ Could not connect file to voucher:", connectionJson);
      return new Response("Voucher connection failed", { status: 500, headers: corsHeaders });
    }

    console.log(`✅ File successfully connected to voucher.`);

    return new Response(JSON.stringify({ 
      success: true, 
      fileId,
      message: "File attached to voucher successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});