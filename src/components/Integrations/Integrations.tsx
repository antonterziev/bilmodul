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
        { number: "1680", name: "Förskottsbetalning" },
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
    // Only allow numbers and limit to 4 digits
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    setAccountNumbers(prev => ({
      ...prev,
      [accountName]: numericValue
    }));
  };

  const saveAccountNumber = async (accountName: string) => {
    const accountNumber = accountNumbers[accountName];
    if (!accountNumber || accountNumber.length !== 4) {
      toast({
        title: "Ogiltigt kontonummer",
        description: "Kontonummer måste vara exakt 4 siffror",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Fel",
        description: "Ingen användare inloggad",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get user's organization first
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error('Could not find user organization');
      }

      // Upsert the account mapping (organization-wide, no user_id)
      const { error } = await supabase
        .from('account_mappings')
        .upsert({
          organization_id: profile.organization_id,
          account_name: accountName,
          account_number: accountNumber,
          user_id: null
        }, {
          onConflict: 'organization_id,account_name'
        });

      if (error) throw error;

      // Also trigger a recheck of the account in Fortnox
      await checkAccountInFortnox(accountName);
      
      toast({
        title: "Kontonummer sparat",
        description: `Kontonummer ${accountNumber} har sparats för ${accountName}`,
      });
    } catch (error) {
      console.error('Error saving account number:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara kontonummer",
        variant: "destructive",
      });
    }
  };

  // Load saved account mappings on component mount
  const loadAccountMappings = async () => {
    if (!user?.id) return;

    try {
      // Get user's organization first
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) {
        console.error('Could not find user organization');
        return;
      }

      // Load organization-wide account mappings
      const { data: mappings, error } = await supabase
        .from('account_mappings')
        .select('account_name, account_number')
        .eq('organization_id', profile.organization_id);

      if (error) {
        console.error('Error loading account mappings:', error);
        return;
      }

      if (mappings) {
        const mappingsObject: {[key: string]: string} = {};
        mappings.forEach(mapping => {
          mappingsObject[mapping.account_name] = mapping.account_number;
        });
        
        // Merge with default account numbers
        setAccountNumbers(prev => ({
          ...prev,
          ...mappingsObject
        }));
      }
    } catch (error) {
      console.error('Error loading account mappings:', error);
    }
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
    
    // Test connection first
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
    
    // Get all accounts from all categories
    const allAccounts: Array<{name: string, number?: string}> = [];
    accountCategories.forEach(category => {
      category.accounts.forEach(account => {
        allAccounts.push({
          name: account.name,
          number: account.number
        });
      });
    });

    const newAccountNames = {...fortnoxAccountNames};

    try {
      for (let i = 0; i < allAccounts.length; i++) {
        const account = allAccounts[i];
        const accountNumber = accountNumbers[account.name] || account.number;
        
        console.log(`🔄 Bulk sync ${i + 1}/${allAccounts.length}: ${account.name}`);
        
        // 1. If no account number, set as "Konto ej kontrollerat"
        if (!accountNumber) {
          newAccountNames[account.name] = "Konto ej kontrollerat";
          console.log(`📝 No number for ${account.name}, set to "Konto ej kontrollerat"`);
          continue;
        }

        // 2. Check account in Fortnox API
        try {
          const { data, error } = await supabase.functions.invoke('fortnox-check-account', {
            body: {
              accountNumber: accountNumber,
              userId: user.id
            }
          });

          if (error) {
            console.error(`❌ API error for ${account.name}:`, error);
            if (error.message?.includes('Token expired')) {
              setAutoCheckingAccounts(false);
              toast({
                title: "Token utgått",
                description: "Fortnox-token har gått ut. Vänligen anslut igen.",
                variant: "destructive"
              });
              return;
            }
            // On other errors, mark as "Konto ej kontrollerat"
            newAccountNames[account.name] = "Konto ej kontrollerat";
            continue;
          }

          // 3. Save the result from API
          if (data?.success) {
            // The API succeeded, now check what it found
            if (data.exists) {
              // Account exists and is active - save the actual name
              newAccountNames[account.name] = data.accountName;
              console.log(`✅ ${account.name}: Found active account "${data.accountName}"`);
            } else {
              // Account exists but is inactive
              newAccountNames[account.name] = "Kontonummer ej aktivt";
              console.log(`⚠️ ${account.name}: Account inactive`);
            }
          } else {
            // API call failed for unknown reason
            newAccountNames[account.name] = "Konto ej kontrollerat";
            console.log(`❌ ${account.name}: API call failed`);
          }
        } catch (error) {
          console.error(`❌ Exception for ${account.name}:`, error);
          newAccountNames[account.name] = "Konto ej kontrollerat";
        }

        // Small delay between API calls
        if (i < allAccounts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Save all results at once
      setFortnoxAccountNames(newAccountNames);
      localStorage.setItem('fortnoxAccountNames', JSON.stringify(newAccountNames));
      
      toast({
        title: "Bulk-synkronisering slutförd",
        description: `Kontrollerade ${allAccounts.length} konton`,
      });

    } catch (error) {
      console.error('Bulk sync error:', error);
      toast({
        title: "Fel vid bulk-synkronisering",
        description: "Ett fel uppstod under synkroniseringen",
        variant: "destructive",
      });
    } finally {
      setAutoCheckingAccounts(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadFortnoxIntegration();
      loadAccountMappings(); // Load saved account mappings
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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Integrationer</h2>
      <p className="text-muted-foreground">Här hittar du alla integrationer som för närvarande finns i Bilmodul.</p>
      
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
                    // Check if all categories are currently open
                    const allExpanded = accountCategories.every(category => openCategories[category.key]);
                    
                    // If all are expanded, collapse all. Otherwise, expand all.
                    accountCategories.forEach(category => {
                      newOpenCategories[category.key] = !allExpanded;
                    });
                    setOpenCategories(newOpenCategories);
                  }}
                  className="text-xs w-32"
                >
                  {/* Show collapse icon and text if all are expanded, otherwise show expand */}
                  {accountCategories.every(category => openCategories[category.key]) ? (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      Kollapsa alla
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Expandera alla
                    </>
                  )}
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
                    <div className="mt-2 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-32">Kontonummer</TableHead>
                            <TableHead className="w-48">Kontonamn</TableHead>
                            <TableHead className="w-64">Kontonamn i Fortnox</TableHead>
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
                                   className="w-20 h-8 text-center"
                                   placeholder="0000"
                                   maxLength={4}
                                 />
                               </TableCell>
                              <TableCell>{account.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="text"
                                  value={
                                    // Show the actual account name from Fortnox, or appropriate status message
                                    fortnoxAccountNames[account.name] && 
                                    !["Konto ej kontrollerat", "Kontonummer ej aktivt"].includes(fortnoxAccountNames[account.name])
                                      ? fortnoxAccountNames[account.name] // Real account name from Fortnox
                                      : "" // Empty if no real name found
                                  }
                                  disabled
                                  className="h-8 bg-muted text-muted-foreground cursor-not-allowed text-left truncate pl-3"
                                  readOnly
                                  placeholder={
                                    !accountNumbers[account.name] && !account.number 
                                      ? "Kontonummer saknas"
                                      : fortnoxAccountNames[account.name] === "Kontonummer ej aktivt"
                                        ? "Kontonummer ej aktivt"
                                        : "Konto ej kontrollerat"
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="default"
                                  className={`text-xs whitespace-nowrap px-2 py-1 flex items-center justify-center w-16 h-6 text-white ${
                                    // Only show green/Aktiv if we have a real account name (not error messages)
                                    fortnoxAccountNames[account.name] && 
                                    !["Konto ej kontrollerat", "Kontonummer ej aktivt", "Kontonummer saknas", "Fel vid kontroll"].includes(fortnoxAccountNames[account.name])
                                      ? 'bg-green-500 hover:bg-green-500'
                                      : 'bg-gray-400 hover:bg-gray-400'
                                  }`}
                                >
                                  {/* Only show Aktiv if we have a real account name from Fortnox */}
                                  {fortnoxAccountNames[account.name] && 
                                   !["Konto ej kontrollerat", "Kontonummer ej aktivt", "Kontonummer saknas", "Fel vid kontroll"].includes(fortnoxAccountNames[account.name]) 
                                    ? 'Aktiv' : 'Inaktiv'}
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