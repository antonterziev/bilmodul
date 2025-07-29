import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, Unlink, RefreshCw, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
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
  const [openCategories, setOpenCategories] = useState<{[key: string]: boolean}>({
    lager: false,
    fordringar: false,
    likvidaMedel: false,
    skulder: false,
    moms: false,
    forsaljning: false,
    inkop: false
  });
  const [accountNumbers, setAccountNumbers] = useState<{[key: string]: string}>({});
  const [fortnoxAccountNames, setFortnoxAccountNames] = useState<{[key: string]: string}>(() => {
    const saved = localStorage.getItem('fortnoxAccountNames');
    return saved ? JSON.parse(saved) : {};
  });
  const [checkingAccounts, setCheckingAccounts] = useState<{[key: string]: boolean}>({});
  const [autoCheckingAccounts, setAutoCheckingAccounts] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { handleFortnoxError, reconnectFortnox } = useFortnoxConnection();

  // Organized chart of accounts by category
  const accountCategories = [
    {
      key: "lager",
      name: "Lager",
      accounts: [
        { number: "1410", name: "Lager - VMB-bilar" },
        { number: "1411", name: "Lager - Momsbilar" },
        { number: "1412", name: "Lager - Momsbilar - EU" },
        { number: "1413", name: "Lager - VMB-bilar - EU" },
        { number: "1414", name: "Lager - Påkostnader" }
      ]
    },
    {
      key: "fordringar",
      name: "Fordringar",
      accounts: [
        { number: "1510", name: "Kundfordringar" }
      ]
    },
    {
      key: "likvidaMedel",
      name: "Likvida medel",
      accounts: [
        { number: "1930", name: "Bankkonto 1" },
        { number: "1931", name: "Bankkonto 2" },
        { number: "1932", name: "Bankkonto 3" }
      ]
    },
    {
      key: "skulder", 
      name: "Skulder",
      accounts: [
        { number: "2440", name: "Leverantörsskulder" }
      ]
    },
    {
      key: "moms",
      name: "Moms",
      accounts: [
        { number: "2611", name: "Utgående moms" },
        { number: "2614", name: "Omvänd utgående moms - matchas 2645" },
        { number: "2616", name: "Moms inköpsmarginalbeskattning" },
        { number: "2641", name: "Ingående moms" },
        { number: "2645", name: "Omvänd ingående moms - matchas 2614" }
      ]
    },
    {
      key: "forsaljning",
      name: "Försäljning", 
      accounts: [
        { number: "3020", name: "Försäljning VMB" },
        { number: "3028", name: "Beskattningsunderlag" },
        { number: "3030", name: "Omföringskonto beskattningsunderlag" },
        { number: "3051", name: "Försäljning Momsbil" },
        { number: "3058", name: "Försäljning inom EU" },
        { number: "3590", name: "Övrig försäljning" }
      ]
    },
    {
      key: "inkop",
      name: "Inköp",
      accounts: [
        { number: "4010", name: "Inköp - Momsbil" },
        { number: "4011", name: "Inköp - Momsbil EU" },
        { number: "4020", name: "Inköp - VMB" },
        { number: "4021", name: "Inköp - VMB EU" },
        { number: "4030", name: "Påkostnader" },
        { number: "4531", name: "Inköp av varor från EU" },
        { number: "4539", name: "Motkonto inköp av varor från EU" }
      ]
    }
  ];

  const toggleCategory = (categoryKey: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  // Initialize account numbers when component mounts
  useEffect(() => {
    const initialAccountNumbers: {[key: string]: string} = {};
    accountCategories.forEach(category => {
      category.accounts.forEach(account => {
        initialAccountNumbers[account.name] = account.number;
      });
    });
    setAccountNumbers(initialAccountNumbers);
  }, []);

  const handleAccountNumberChange = (accountName: string, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '');
    setAccountNumbers(prev => ({
      ...prev,
      [accountName]: numericValue
    }));
  };

  const checkAccountInFortnox = async (accountName: string, silent = false) => {
    console.log(`🔍 Starting check for account: ${accountName}, silent: ${silent}`);
    
    if (!user?.id) {
      console.log(`❌ No user ID for account: ${accountName}`);
      if (!silent) {
        toast({
          title: "Fel",
          description: "Ingen användare inloggad",
          variant: "destructive",
        });
      }
      return;
    }

    // Find the account definition to get the default number
    const accountDef = accountCategories
      .flatMap(cat => cat.accounts)
      .find(acc => acc.name === accountName);
    
    console.log(`🔍 Account definition for ${accountName}:`, accountDef);
    
    const accountNumber = accountNumbers[accountName] || accountDef?.number;
    console.log(`🔍 Account number for ${accountName}: ${accountNumber} (from state: ${accountNumbers[accountName]}, from def: ${accountDef?.number})`);
    
    if (!accountNumber) {
      console.log(`❌ No account number found for: ${accountName}`);
      
      // Set status to "Kontonummer saknas" for accounts without numbers
      const newAccountNames = {
        ...fortnoxAccountNames,
        [accountName]: "Kontonummer saknas"
      };
      setFortnoxAccountNames(newAccountNames);
      localStorage.setItem('fortnoxAccountNames', JSON.stringify(newAccountNames));
      
      if (!silent) {
        toast({
          title: "Fel", 
          description: "Inget kontonummer angivet",
          variant: "destructive",
        });
      }
      return;
    }

    setCheckingAccounts(prev => ({ ...prev, [accountName]: true }));
    console.log(`🚀 Making API call for account: ${accountName} with number: ${accountNumber}`);

    try {
      const { data, error } = await supabase.functions.invoke('fortnox-check-account', {
        body: {
          accountNumber: accountNumber,
          userId: user.id
        }
      });

      if (error) {
        console.error('Error checking account:', error);
        
        if (error.message?.includes('Token expired') || error.message?.includes('needsReconnection')) {
          const shouldReconnect = await handleFortnoxError(error);
          if (shouldReconnect) {
            await reconnectFortnox(user.id);
          }
          return;
        }
        
        throw error;
      }

      if (data?.success) {
        const newAccountNames = {
          ...fortnoxAccountNames,
          [accountName]: data.accountName
        };
        setFortnoxAccountNames(newAccountNames);
        localStorage.setItem('fortnoxAccountNames', JSON.stringify(newAccountNames));

        if (!silent) {
          toast({
            title: "Kontroll slutförd",
            description: data.exists 
              ? `Kontot hittades: ${data.accountName}`
              : "Kontot hittades inte eller är inaktivt",
          });
        }
      } else {
        throw new Error(data?.error || 'Okänt fel vid kontokontroll');
      }

    } catch (error: any) {
      console.error('Error checking account:', error);
      if (!silent) {
        toast({
          title: "Fel vid kontokontroll",
          description: error.message || "Kunde inte kontrollera kontot",
          variant: "destructive",
        });
      }

      // Only set error message for non-API errors since the edge function handles account status properly
      if (!error.message?.includes('accountName')) {
        const newAccountNames = {
          ...fortnoxAccountNames,
          [accountName]: "Fel vid kontroll"
        };
        setFortnoxAccountNames(newAccountNames);
        localStorage.setItem('fortnoxAccountNames', JSON.stringify(newAccountNames));
      }
    } finally {
      setCheckingAccounts(prev => ({ ...prev, [accountName]: false }));
    }
  };

  // Function to check all accounts automatically
  const checkAllAccountsInFortnox = async () => {
    if (!user?.id) return;
    
    // First, test the connection to make sure we have a valid token
    try {
      const { data, error } = await supabase.functions.invoke('fortnox-test-connection');
      
      if (error || !data?.success) {
        toast({
          title: "Anslutning krävs",
          description: "Fortnox-anslutningen är inte aktiv. Vänligen anslut igen.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      toast({
        title: "Anslutning krävs", 
        description: "Kunde inte validera Fortnox-anslutningen. Vänligen anslut igen.",
        variant: "destructive",
      });
      return;
    }
    
    setAutoCheckingAccounts(true);
    
    // Get all account names from all categories
    const allAccountNames: string[] = [];
    accountCategories.forEach(category => {
      console.log(`📋 Processing category: ${category.name}`);
      category.accounts.forEach(account => {
        console.log(`📝 Adding account to bulk sync: ${account.name} (${account.number})`);
        allAccountNames.push(account.name);
      });
    });
    
    console.log(`🔢 Total accounts to check: ${allAccountNames.length}`, allAccountNames);

    try {
      // Check accounts one by one sequentially
      for (let i = 0; i < allAccountNames.length; i++) {
        const accountName = allAccountNames[i];
        console.log(`🔄 Bulk checking account ${i + 1}/${allAccountNames.length}: ${accountName}`);
        
        try {
          console.log(`🔄 About to check account: ${accountName}`);
          console.log(`📊 Current fortnoxAccountNames before check:`, fortnoxAccountNames[accountName]);
          
          const result = await checkAccountInFortnox(accountName);
          
          console.log(`📊 Current fortnoxAccountNames after check:`, fortnoxAccountNames[accountName]);
          console.log(`✅ Bulk check result for ${accountName}:`, result);
        } catch (error: any) {
          console.error(`❌ Error checking account ${accountName}:`, error);
          
          // Check if it's a token expiration error
          if (error?.message?.includes('Token expired')) {
            setAutoCheckingAccounts(false);
            toast({
              title: "Anslutning krävs",
              description: "Fortnox-token har gått ut. Vänligen anslut igen.",
              variant: "destructive"
            });
            return;
          }
        }
        
        // Small delay between each account to be API-friendly
        if (i < allAccountNames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      toast({
        title: "Kontokontroll slutförd",
        description: "Alla konton har kontrollerats mot Fortnox",
      });
    } catch (error) {
      console.error('Error during bulk account check:', error);
      toast({
        title: "Fel vid kontokontroll",
        description: "Ett fel uppstod under kontrollen av kontona",
        variant: "destructive"
      });
    } finally {
      setAutoCheckingAccounts(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFortnoxIntegration();
    }
  }, [user]);

  // Refresh connection status when component becomes visible or integrations tab is accessed
  useEffect(() => {
    const refreshConnection = () => {
      if (user) {
        loadFortnoxIntegration();
      }
    };
    
    // Listen for visibility changes (when user switches tabs)
    document.addEventListener('visibilitychange', refreshConnection);
    
    return () => {
      document.removeEventListener('visibilitychange', refreshConnection);
    };
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
                  className={`text-xs whitespace-nowrap px-2 justify-center w-16 text-white bg-gray-400 hover:bg-gray-400 ${
                    fortnoxConnected 
                      ? 'bg-green-500 hover:bg-green-500' 
                      : 'bg-gray-400 hover:bg-gray-400'
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
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        if (!user?.id) return;
                        
                        try {
                          const { data, error } = await supabase.functions.invoke('fortnox-test-connection');
                          
                          if (error) {
                            console.error('Test connection error:', error);
                            toast({
                              title: "Anslutningstest misslyckades",
                              description: error.message || "Okänt fel uppstod",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          if (data?.success) {
                            toast({
                              title: "Anslutning fungerar!",
                              description: `Framgångsrikt anslutet till ${data.companyName || 'Fortnox'}`,
                            });
                          } else {
                            toast({
                              title: "Anslutningstest misslyckades",
                              description: data?.message || "Anslutningen fungerar inte korrekt",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error('Test connection error:', error);
                          toast({
                            title: "Anslutningstest misslyckades",
                            description: "Ett fel uppstod vid test av anslutning",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Testa anslutning
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={checkAllAccountsInFortnox}
                      disabled={autoCheckingAccounts}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${autoCheckingAccounts ? 'animate-spin' : ''}`} />
                      Synkronisera
                    </Button>
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
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkAllAccountsInFortnox}
                    disabled={!fortnoxConnected || autoCheckingAccounts}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${autoCheckingAccounts ? 'animate-spin' : ''}`} />
                    Synkronisera
                  </Button>
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart of Accounts - Only shown when Fortnox is connected */}
        {fortnoxConnected && (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Kontoplan</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOpenCategories = { ...openCategories };
                    accountCategories.forEach(category => {
                      newOpenCategories[category.key] = true;
                    });
                    setOpenCategories(newOpenCategories);
                  }}
                  className="text-xs"
                >
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Expandera alla
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newOpenCategories = { ...openCategories };
                    accountCategories.forEach(category => {
                      newOpenCategories[category.key] = false;
                    });
                    setOpenCategories(newOpenCategories);
                  }}
                  className="text-xs"
                >
                  <ChevronRight className="h-3 w-3 mr-1" />
                  Kollaps alla
                </Button>
              </div>
              {autoCheckingAccounts && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Kontrollerar alla konton...
                </div>
              )}
            </div>
            <div className="space-y-2">
              {accountCategories.map((category) => (
                <Collapsible 
                  key={category.key}
                  open={openCategories[category.key]}
                  onOpenChange={() => toggleCategory(category.key)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      <span className="font-medium text-left">{category.name}</span>
                      {openCategories[category.key] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-4 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Kontonummer</TableHead>
                            <TableHead>Kontonamn</TableHead>
                            <TableHead>Kontonamn i Fortnox</TableHead>
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-16">Sync</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {category.accounts.map((account) => (
                            <TableRow key={account.number}>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={accountNumbers[account.name] || account.number}
                                  onChange={(e) => handleAccountNumberChange(account.name, e.target.value)}
                                  className="w-24 h-8 text-center font-medium"
                                  placeholder="Kontonummer"
                                />
                              </TableCell>
                              <TableCell>{account.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={
                                    fortnoxAccountNames[account.name] || 
                                    ((!accountNumbers[account.name] && !account.number) ? "Kontonummer saknas" : "")
                                  }
                                  disabled
                                  className="h-8 bg-muted text-muted-foreground cursor-not-allowed"
                                  readOnly
                                  placeholder="Konto ej kontrollerat"
                                />
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="default"
                                  className={`text-xs whitespace-nowrap px-2 justify-center w-16 text-white ${
                                    fortnoxAccountNames[account.name] && fortnoxAccountNames[account.name] !== "Kontonummer ej aktivt"
                                      ? 'bg-green-500 hover:bg-green-500'
                                      : 'bg-gray-400 hover:bg-gray-400'
                                  }`}
                                >
                                  {fortnoxAccountNames[account.name] && fortnoxAccountNames[account.name] !== "Kontonummer ej aktivt" ? 'Aktiv' : 'Inaktiv'}
                                </Badge>
                              </TableCell>
                               <TableCell className="text-center">
                                 <Button 
                                   variant="outline" 
                                   size="sm" 
                                   className="w-10 h-10 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                   onClick={() => checkAccountInFortnox(account.name)}
                                   disabled={checkingAccounts[account.name]}
                                 >
                                   {checkingAccounts[account.name] ? (
                                     <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                   ) : (
                                     <ArrowUpDown className="h-4 w-4" />
                                   )}
                                 </Button>
                               </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};