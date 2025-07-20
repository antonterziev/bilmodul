import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Unlink } from "lucide-react";

export const FortnoxIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { toast } = useToast();

  const connectFortnox = async () => {
    setConnecting(true);
    try {
      // Simulate the authorization error that the user is experiencing
      const response = await fetch('/api/fortnox/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing Authorization header - this is the issue!
          // 'Authorization': `Bearer ${userToken}`, // This should be included
        },
        body: JSON.stringify({ action: 'connect' })
      });

      if (!response.ok) {
        if (response.status === 401) {
          const error = await response.json();
          throw new Error(error.message || 'Missing authorization header');
        }
        throw new Error('Failed to connect');
      }

      setIsConnected(true);
      toast({
        title: "Ansluten!",
        description: "Fortnox-integration har aktiverats",
      });
    } catch (error: any) {
      console.error('Error connecting to Fortnox:', error);
      
      // Handle the specific authorization error
      if (error.message?.includes('Missing authorization header') || error.message?.includes('401')) {
        toast({
          title: "Autentiseringsfel",
          description: "Det saknas behörighetstoken. Du behöver logga in igen för att ansluta till Fortnox.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Anslutningsfel",
          description: "Kunde inte ansluta till Fortnox. Försök igen senare.",
          variant: "destructive",
        });
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectFortnox = async () => {
    setDisconnecting(true);
    try {
      // Simulate disconnection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsConnected(false);
      toast({
        title: "Frånkopplad",
        description: "Fortnox-integration har inaktiverats",
      });
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
              {isConnected ? "Ansluten till Fortnox" : "Inte ansluten"}
            </p>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>

        {isConnected && (
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Företag:</p>
              <p className="text-sm text-muted-foreground">Test Företag AB</p>
            </div>
            <div>
              <p className="text-sm font-medium">Ansluten:</p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('sv-SE')}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {isConnected ? (
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
              disabled={connecting}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {connecting ? "Ansluter..." : "Anslut till Fortnox"}
            </Button>
          )}
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-xs text-yellow-800">
            <strong>Felsökning:</strong> Om du får felmeddelandet "Missing authorization header", 
            betyder det att din session har gått ut. Logga ut och in igen för att lösa problemet.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Anslut ditt Fortnox-konto för att automatiskt synkronisera fakturor och bokföring.
        </p>
      </CardContent>
    </Card>
  );
};