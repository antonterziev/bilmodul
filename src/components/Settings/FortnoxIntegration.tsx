import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, RotateCw, CheckCircle, XCircle, Upload } from "lucide-react";

interface FortnoxStatus {
  connected: boolean;
  company_name?: string;
  connected_since?: string;
}

export const FortnoxIntegration = () => {
  const [status, setStatus] = useState<FortnoxStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadStatus();
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      handleOAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'get_status' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Error loading Fortnox status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { 
          action: 'exchange_code',
          code 
        },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Ansluten till Fortnox",
        description: `Framgångsrikt ansluten till ${data.company_name || 'Fortnox'}`,
      });

      loadStatus();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast({
        title: "Anslutningsfel",
        description: "Kunde inte ansluta till Fortnox. Försök igen.",
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
        body: { action: 'get_auth_url' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      // Redirect to Fortnox OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Error connecting to Fortnox:', error);
      toast({
        title: "Anslutningsfel",
        description: "Kunde inte starta Fortnox-anslutning",
        variant: "destructive",
      });
      setConnecting(false);
    }
  };

  const disconnectFortnox = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'disconnect' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Frånkopplad",
        description: "Fortnox-integrationen har kopplats från",
      });

      loadStatus();
    } catch (error) {
      console.error('Error disconnecting from Fortnox:', error);
      toast({
        title: "Fel",
        description: "Kunde inte koppla från Fortnox",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const syncAllVehicles = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-sync', {
        body: { action: 'sync_all_vehicles' },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Synkronisering slutförd",
        description: data.message,
      });
    } catch (error) {
      console.error('Error syncing vehicles:', error);
      toast({
        title: "Synkroniseringsfel",
        description: "Kunde inte synkronisera fordon till Fortnox",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Fortnox Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Laddar integrationsstatus...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5" />
          Fortnox Integration
          {status.connected ? (
            <Badge variant="default" className="ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ansluten
            </Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto">
              <XCircle className="h-3 w-3 mr-1" />
              Ej ansluten
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.connected ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground">
                Ansluten till: <strong>{status.company_name}</strong>
              </p>
              {status.connected_since && (
                <p className="text-xs text-muted-foreground">
                  Ansluten sedan: {new Date(status.connected_since).toLocaleDateString('sv-SE')}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Synkronisering</h4>
              <p className="text-sm text-muted-foreground">
                Synkronisera dina fordon som artiklar i Fortnox för att spåra intäkter och COGS.
              </p>
              
              <div className="flex gap-2">
                <Button 
                  onClick={syncAllVehicles}
                  disabled={syncing}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {syncing ? (
                    <RotateCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {syncing ? "Synkroniserar..." : "Synka alla fordon"}
                </Button>
              </div>
            </div>

            <Separator />

            <Button 
              variant="outline" 
              onClick={disconnectFortnox}
              disabled={disconnecting}
              size="sm"
            >
              {disconnecting ? "Kopplar från..." : "Koppla från Fortnox"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Anslut ditt Fortnox-konto för att automatiskt synkronisera fordon som artiklar 
              och spåra försäljningsintäkter och inköpskostnader.
            </p>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Funktioner:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Synkronisera fordon som artiklar i Fortnox</li>
                <li>• Automatisk spårning av intäkter och COGS</li>
                <li>• Uppdatering av artikelstatus vid försäljning</li>
                <li>• Finansiell rapportering och vinstmarginalanalys</li>
              </ul>
            </div>

            <Button 
              onClick={connectFortnox}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? "Ansluter..." : "Anslut till Fortnox"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};