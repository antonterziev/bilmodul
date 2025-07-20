import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CheckCircle, XCircle, RefreshCw, Users, FileText, Plus } from "lucide-react";

interface FortnoxIntegration {
  id: string;
  company_name: string;
  is_active: boolean;
  token_expires_at: string;
  created_at: string;
}

interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  Email?: string;
  Phone?: string;
}

interface FortnoxInvoice {
  DocumentNumber: string;
  InvoiceDate: string;
  CustomerNumber: string;
  Total: number;
  Currency: string;
}

const FortnoxIntegration = () => {
  const [integration, setIntegration] = useState<FortnoxIntegration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customers, setCustomers] = useState<FortnoxCustomer[]>([]);
  const [invoices, setInvoices] = useState<FortnoxInvoice[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'invoices'>('overview');
  const { toast } = useToast();

  useEffect(() => {
    fetchIntegration();
  }, []);

  const fetchIntegration = async () => {
    try {
      const { data, error } = await supabase
        .from('fortnox_integrations')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setIntegration(data);
    } catch (error) {
      console.error('Failed to fetch integration:', error);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'get_auth_url' }
      });

      if (response.error) throw response.error;

      const { auth_url } = response.data;
      window.open(auth_url, '_blank', 'width=600,height=700');

      // Listen for the OAuth callback
      const pollForConnection = setInterval(async () => {
        await fetchIntegration();
        const { data } = await supabase
          .from('fortnox_integrations')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          clearInterval(pollForConnection);
          setIntegration(data);
          toast({
            title: "Anslutning lyckades!",
            description: `Ansluten till ${data.company_name}`,
          });
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(pollForConnection), 300000);

    } catch (error: any) {
      toast({
        title: "Anslutning misslyckades",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('fortnox-oauth', {
        body: { action: 'disconnect' }
      });

      if (response.error) throw response.error;

      setIntegration(null);
      setCustomers([]);
      setInvoices([]);
      toast({
        title: "Frånkopplad",
        description: "Fortnox-integreringen har frånkopplats",
      });
    } catch (error: any) {
      toast({
        title: "Fel vid frånkoppling",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('fortnox-sync', {
        body: { action: 'sync_customers' }
      });

      if (response.error) throw response.error;

      setCustomers(response.data.customers || []);
      toast({
        title: "Kunder synkroniserade",
        description: `${response.data.customers?.length || 0} kunder hämtade från Fortnox`,
      });
    } catch (error: any) {
      toast({
        title: "Synkronisering misslyckades",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const syncInvoices = async () => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('fortnox-sync', {
        body: { action: 'sync_invoices' }
      });

      if (response.error) throw response.error;

      setInvoices(response.data.invoices || []);
      toast({
        title: "Fakturor synkroniserade",
        description: `${response.data.invoices?.length || 0} fakturor hämtade från Fortnox`,
      });
    } catch (error: any) {
      toast({
        title: "Synkronisering misslyckades",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isTokenExpiringSoon = () => {
    if (!integration?.token_expires_at) return false;
    const expiresAt = new Date(integration.token_expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry < 24;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle>Fortnox Integration</CardTitle>
                <CardDescription>
                  Anslut ditt Fortnox-konto för automatisk synkronisering av kunder och fakturor
                </CardDescription>
              </div>
            </div>
            {integration ? (
              <Badge variant={integration.is_active ? "default" : "secondary"} className="flex items-center space-x-1">
                {integration.is_active ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                <span>{integration.is_active ? "Ansluten" : "Frånkopplad"}</span>
              </Badge>
            ) : (
              <Badge variant="outline">Inte ansluten</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {integration ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Företag</p>
                  <p className="text-lg font-semibold">{integration.company_name || 'Okänt företag'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Ansluten sedan</p>
                  <p className="text-lg font-semibold">
                    {new Date(integration.created_at).toLocaleDateString('sv-SE')}
                  </p>
                </div>
              </div>

              {isTokenExpiringSoon() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Din Fortnox-token går ut snart. Anslutningen kommer att förnyas automatiskt vid nästa synkronisering.
                  </p>
                </div>
              )}

              <div className="flex space-x-2">
                <Button onClick={handleDisconnect} variant="outline" disabled={isLoading}>
                  Koppla från
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">
                Du har inte anslutit ditt Fortnox-konto än. Anslut för att synkronisera dina kunder och fakturor.
              </p>
              <Button onClick={handleConnect} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Ansluter...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Anslut Fortnox
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {integration && (
        <div className="space-y-4">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Översikt
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'customers' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Kunder
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'invoices' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Fakturor
            </button>
          </div>

          {activeTab === 'overview' && (
            <Card>
              <CardHeader>
                <CardTitle>Snabbåtgärder</CardTitle>
                <CardDescription>
                  Synkronisera data från ditt Fortnox-konto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={syncCustomers} disabled={isLoading} variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    Synka kunder
                  </Button>
                  <Button onClick={syncInvoices} disabled={isLoading} variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Synka fakturor
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'customers' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Kunder från Fortnox</CardTitle>
                    <CardDescription>
                      {customers.length > 0 ? `${customers.length} kunder hämtade` : 'Inga kunder hämtade än'}
                    </CardDescription>
                  </div>
                  <Button onClick={syncCustomers} disabled={isLoading} size="sm">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Uppdatera
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {customers.length > 0 ? (
                  <div className="space-y-3">
                    {customers.slice(0, 10).map((customer) => (
                      <div key={customer.CustomerNumber} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{customer.Name}</p>
                            <p className="text-sm text-gray-500">Kundnummer: {customer.CustomerNumber}</p>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            {customer.Email && <p>📧 {customer.Email}</p>}
                            {customer.Phone && <p>📞 {customer.Phone}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {customers.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... och {customers.length - 10} till
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Klicka på "Uppdatera" för att hämta kunder från Fortnox
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'invoices' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Fakturor från Fortnox</CardTitle>
                    <CardDescription>
                      {invoices.length > 0 ? `${invoices.length} fakturor hämtade` : 'Inga fakturor hämtade än'}
                    </CardDescription>
                  </div>
                  <Button onClick={syncInvoices} disabled={isLoading} size="sm">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Uppdatera
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <div className="space-y-3">
                    {invoices.slice(0, 10).map((invoice) => (
                      <div key={invoice.DocumentNumber} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Faktura #{invoice.DocumentNumber}</p>
                            <p className="text-sm text-gray-500">
                              Kund: {invoice.CustomerNumber} | Datum: {invoice.InvoiceDate}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{invoice.Total} {invoice.Currency}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {invoices.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        ... och {invoices.length - 10} till
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">
                    Klicka på "Uppdatera" för att hämta fakturor från Fortnox
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default FortnoxIntegration;