import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, Unlink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFortnoxConnection } from "@/hooks/useFortnoxConnection";

interface FortnoxIntegration {
  id: string;
  user_id: string;
  company_name: string;
  fortnox_company_id: string;
  is_active: boolean;
  created_at: string;
}

export const Integrations = () => {
  const [fortnoxIntegration, setFortnoxIntegration] = useState<FortnoxIntegration | null>(null);
  const [fortnoxConnected, setFortnoxConnected] = useState(false);
  const [disconnectingFortnox, setDisconnectingFortnox] = useState(false);
  const [accountMappings, setAccountMappings] = useState({
    inkopVmbFordon: "",
    inkopMomsFordon: "",
    kostnadReparation: "",
    intaktForsaljning: ""
  });
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleFortnoxError, reconnectFortnox } = useFortnoxConnection();

  useEffect(() => {
    if (user) {
      loadFortnoxIntegration();
    }
  }, [user]);

  const loadFortnoxIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('fortnox_integrations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      console.log('Fortnox integration data:', data);
      console.log('Setting fortnoxConnected to:', !!data);
      setFortnoxIntegration(data);
      setFortnoxConnected(!!data);
    } catch (error) {
      console.error('Error loading Fortnox integration:', error);
    }
  };

  const disconnectFortnox = async () => {
    if (!fortnoxIntegration) return;

    setDisconnectingFortnox(true);
    try {
      const { error } = await supabase
        .from('fortnox_integrations')
        .update({ is_active: false })
        .eq('id', fortnoxIntegration.id);

      if (error) throw error;

      setFortnoxIntegration(null);
      setFortnoxConnected(false);
      toast({
        title: "Frånkopplad",
        description: "Du har kopplats från Fortnox",
      });
    } catch (error) {
      console.error('Error disconnecting Fortnox:', error);
      toast({
        title: "Fel",
        description: "Kunde inte koppla från Fortnox",
        variant: "destructive",
      });
    } finally {
      setDisconnectingFortnox(false);
    }
  };


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Integrationer</h1>
      <p className="text-muted-foreground mb-6">Här hittar du alla integrationer som för närvarande finns i Veksla.</p>
      
      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center">
                <img src="/lovable-uploads/06ce5fbb-cb35-47f9-9b24-5b51bdbe0647.png" alt="Fortnox" className="w-10 h-10 object-contain" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Automatisk bokföring – Fortnox</h3>
                <p className="text-sm text-muted-foreground">Bokför dina fordonsaffärer smidigt och automatiskt med Fortnox</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <Badge 
                  variant="default"
                  className={`text-xs whitespace-nowrap px-2 justify-center w-16 text-white ${
                    fortnoxConnected 
                      ? 'bg-green-500' 
                      : 'bg-gray-500'
                  }`}
                >
                  {fortnoxConnected ? 'Aktiv' : 'Inaktiv'}
                </Badge>
              </div>
              
              {fortnoxConnected && fortnoxIntegration ? (
                <div className="flex items-center justify-between w-full">
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {fortnoxIntegration.company_name || 'Okänt företag'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Kopplad: {new Date(fortnoxIntegration.created_at).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={disconnectFortnox}
                    disabled={disconnectingFortnox}
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    {disconnectingFortnox ? "Kopplar från..." : "Koppla från"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!user?.id) {
                      console.error('User not authenticated');
                      return;
                    }

                    console.log('Koppla button clicked - initiating Fortnox connection for user:', user.id);
                    try {
                      console.log('Calling fortnox-oauth function...');
                      const { data, error } = await supabase.functions.invoke('fortnox-oauth', {
                        body: { 
                          action: 'get_auth_url',
                          user_id: user.id
                        }
                      });

                      console.log('Fortnox OAuth response:', { data, error });

                      if (error) {
                        console.error('Fortnox OAuth error:', error);
                        throw error;
                      }

                      if (!data?.auth_url) {
                        throw new Error('No auth URL received from Fortnox OAuth function');
                      }

                      console.log('Opening Fortnox OAuth in popup:', data.auth_url);
                      // Open Fortnox OAuth in popup
                      const popup = window.open(
                        data.auth_url, 
                        'fortnox-oauth', 
                        'width=600,height=700,scrollbars=yes,resizable=yes'
                      );
                      
                      // Listen for popup completion
                      const checkClosed = setInterval(() => {
                        if (popup?.closed) {
                          clearInterval(checkClosed);
                          // Force reload the integration data instead of full page refresh
                          console.log('Popup closed, reloading Fortnox integration...');
                          loadFortnoxIntegration();
                        }
                      }, 1000);
                      
                    } catch (error: any) {
                      console.error('Fortnox connection error:', error);
                      alert('Kunde inte ansluta till Fortnox. Försök igen senare.');
                    }
                  }}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Koppla
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Account Mappings Module - Only shown when Fortnox is connected */}
        {fortnoxConnected && (
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Kontoplan</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Inköp VMB-fordon</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={accountMappings.inkopVmbFordon}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Only allow numbers
                      setAccountMappings(prev => ({ ...prev, inkopVmbFordon: value }));
                    }}
                    placeholder="Kontonummer"
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Inköp Moms-fordon</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={accountMappings.inkopMomsFordon}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Only allow numbers
                      setAccountMappings(prev => ({ ...prev, inkopMomsFordon: value }));
                    }}
                    placeholder="Kontonummer"
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Kostnad Reparation</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={accountMappings.kostnadReparation}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Only allow numbers
                      setAccountMappings(prev => ({ ...prev, kostnadReparation: value }));
                    }}
                    placeholder="Kontonummer"
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Intäkt Försäljning</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={accountMappings.intaktForsaljning}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, ''); // Only allow numbers
                      setAccountMappings(prev => ({ ...prev, intaktForsaljning: value }));
                    }}
                    placeholder="Kontonummer"
                    className="w-32"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testa anslutning
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};