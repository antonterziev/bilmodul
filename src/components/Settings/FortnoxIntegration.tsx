import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FortnoxStatus {
  connected: boolean;
  company_name?: string;
  connected_since?: string;
}

export const FortnoxIntegration = () => {
  const [status, setStatus] = useState<FortnoxStatus>({ connected: false });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStatus();
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleOAuthCallback(code);
    }
  }, []);

  const loadStatus = async () => {
    console.log('Loading Fortnox status...');
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'get_status' }
      });

      console.log('Fortnox status response:', { data, error });
      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Failed to load Fortnox status:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'exchange_code', code }
      });

      if (error) throw error;

      setStatus({ 
        connected: true, 
        company_name: data.company_name,
        connected_since: new Date().toISOString()
      });

      toast({
        title: "Ansluten!",
        description: `Fortnox-integration har aktiverats${data.company_name ? ` för ${data.company_name}` : ''}`,
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error: any) {
      toast({
        title: "Anslutningsfel",
        description: error.message || "Kunde inte slutföra anslutningen till Fortnox",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const connectFortnox = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'get_auth_url' }
      });

      if (error) throw error;

      // Redirect to Fortnox OAuth
      window.location.href = data.auth_url;
      
    } catch (error: any) {
      toast({
        title: "Anslutningsfel",
        description: error.message || "Kunde inte ansluta till Fortnox",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const disconnectFortnox = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      setStatus({ connected: false });
      toast({
        title: "Frånkopplad",
        description: "Fortnox-integration har inaktiverats",
      });
    } catch (error: any) {
      toast({
        title: "Fel",
        description: error.message || "Kunde inte koppla från Fortnox",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Fortnox Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Status</h4>
            <p className="text-sm text-muted-foreground">
              {loading ? "Laddar..." : status.connected ? "Ansluten till Fortnox" : "Inte ansluten"}
            </p>
          </div>
          <Badge variant={status.connected ? "default" : "secondary"}>
            {status.connected ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>

        {status.connected && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Företag:</p>
              <p className="text-sm text-muted-foreground">
                {status.company_name || "Okänt företag"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Ansluten:</p>
              <p className="text-sm text-muted-foreground">
                {status.connected_since ? 
                  new Date(status.connected_since).toLocaleDateString('sv-SE') : 
                  new Date().toLocaleDateString('sv-SE')
                }
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {status.connected ? (
            <Button
              variant="outline"
              onClick={disconnectFortnox}
              disabled={disconnecting}
              className="w-full"
            >
              <Unlink className="h-4 w-4 mr-2" />
              {disconnecting ? "Kopplar från..." : "Koppla från Fortnox"}
            </Button>
          ) : (
            <Button
              onClick={connectFortnox}
              disabled={connecting || loading}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {connecting ? "Ansluter..." : "Anslut till Fortnox"}
            </Button>
          )}
        </div>

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs text-blue-800">
            <strong>Info:</strong> När du klickar på "Anslut till Fortnox" kommer du att omdirigeras 
            till Fortnox för att godkänna integrationen.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Anslut ditt Fortnox-konto för att automatiskt synkronisera fakturor och bokföring.
        </p>
      </CardContent>
    </Card>
  );
};