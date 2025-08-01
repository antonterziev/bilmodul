import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Trash2, Eye, DollarSign, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  purchase_date: string;
  selling_date?: string;
  purchaser: string;
  purchase_price: number;
  selling_price: number | null;
  status: string;
  fortnox_sync_status?: string;
  fortnox_verification_number?: string;
  vat_type?: string;
  user_id: string;
  registered_by?: string; // User's name who registered the vehicle
}

interface VehicleListProps {
  filter?: 'all' | 'på_lager' | 'såld';
  
  onStatsUpdate?: () => void;
  onSellVehicle?: (vehicleId: string) => void;
  searchTerm?: string;
  sortField?: 'storage-days' | 'purchase-price' | 'selling-price' | 'gross-profit';
  sortOrder?: 'desc' | 'asc';
}

export const VehicleList = ({ 
  filter = 'all', 
  onSellVehicle,
  onStatsUpdate, 
  searchTerm = "", 
  sortField = 'storage-days',
  sortOrder = 'desc'
}: VehicleListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);
  
  // Use ref to track mounted state and cleanup timers
  const mountedRef = useRef(true);
  const timersRef = useRef<{ timeout?: NodeJS.Timeout; interval?: NodeJS.Timeout }>({});

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user, filter]);

  // Fixed midnight update logic with proper cleanup
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Clear any existing timers
    if (timersRef.current.timeout) {
      clearTimeout(timersRef.current.timeout);
    }
    if (timersRef.current.interval) {
      clearInterval(timersRef.current.interval);
    }
    
    // Set timeout for midnight
    timersRef.current.timeout = setTimeout(() => {
      if (mountedRef.current) {
        setForceUpdate(prev => prev + 1);
        
        // Set interval for every 24 hours after the first midnight
        timersRef.current.interval = setInterval(() => {
          if (mountedRef.current) {
            setForceUpdate(prev => prev + 1);
          }
        }, 24 * 60 * 60 * 1000);
      }
    }, msUntilMidnight);

    // Cleanup function
    return () => {
      if (timersRef.current.timeout) {
        clearTimeout(timersRef.current.timeout);
      }
      if (timersRef.current.interval) {
        clearInterval(timersRef.current.interval);
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadVehicles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First get all vehicles
      let query = supabase
        .from('inventory_items')
        .select(`
          id, registration_number, brand, model, purchase_date, selling_date, 
          purchaser, purchase_price, selling_price, status, 
          fortnox_sync_status, fortnox_verification_number, vat_type, user_id
        `);

      // Apply status filter if not 'all'
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: vehicles, error: vehiclesError } = await query.order('purchase_date', { ascending: false });

      if (vehiclesError) throw vehiclesError;
      
      // Get all unique user IDs from vehicles
      const userIds = [...new Set((vehicles || []).map((v: any) => v.user_id))];
      
      // Fetch user profiles for these user IDs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, first_name, last_name')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      // Create a map of user_id to profile for quick lookup
      const profileMap = new Map();
      (profiles || []).forEach((profile: any) => {
        profileMap.set(profile.user_id, profile);
      });
      
      // Transform data to include registered_by field
      const vehiclesWithRegisteredBy = (vehicles || []).map((item: any) => {
        const profile = profileMap.get(item.user_id);
        return {
          ...item,
          registered_by: profile?.full_name || 
                        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
                        'Okänd användare'
        };
      });
      
      setVehicles(vehiclesWithRegisteredBy);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'outline' as const; // Outline style like Bokförd
      case 'på_väg':
        return 'secondary' as const;
      case 'såld':
        return 'outline' as const;
      default:
        return 'default' as const;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'på_lager':
        return 'I lager';
      case 'på_väg':
        return 'På väg';
      case 'såld':
        return 'Såld';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const calculateStorageDays = (purchaseDate: string, status: string, sellingDate?: string) => {
    const purchase = new Date(purchaseDate);
    purchase.setHours(0, 0, 0, 0); // Reset to start of purchase day
    
    let endDate: Date;
    if (status === 'såld' && sellingDate) {
      // For sold vehicles, use selling date
      endDate = new Date(sellingDate);
      endDate.setHours(0, 0, 0, 0); // Reset to start of selling day
    } else {
      // For vehicles in stock, use today's date
      endDate = new Date();
      endDate.setHours(0, 0, 0, 0); // Reset to start of today
    }
    
    const diffTime = endDate.getTime() - purchase.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1); // Ensure minimum 1 day, add 1 to include both start and end day
  };

  const formatPurchaserName = (fullName: string) => {
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length === 1) {
      return nameParts[0]; // Only first name
    }
    const firstName = nameParts[0];
    const lastNameInitial = nameParts[nameParts.length - 1][0]; // Get first letter of last name
    return `${firstName} ${lastNameInitial}`;
  };

  const handleDelete = async (vehicleId: string, registrationNumber: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${registrationNumber}? Detta kan inte ångras.`)) {
      return;
    }

    try {
      setDeletingId(vehicleId);

      // First check if vehicle is synced with Fortnox
      const vehicle = vehicles.find(v => v.id === vehicleId);
      
      // If synced with Fortnox, create a correction voucher FIRST
      if (vehicle?.fortnox_sync_status === 'synced' && vehicle?.fortnox_verification_number) {
        const { data, error } = await supabase.functions.invoke('fortnox-makulering-verifikat', {
          body: { 
            series: 'A',
            number: vehicle.fortnox_verification_number,
            userId: user?.id,
            correctionSeries: 'A'
          }
        });

        if (error) throw error;

        if (!data?.success) {
          throw new Error(data?.error || 'Okänt fel vid skapande av ändringsverifikation');
        }

        toast({
          title: "Ändringsverifikation skapad",
          description: `${data.message} för att makulera originalverifikatet.`,
        });
      }

      // Only delete the vehicle if Fortnox correction succeeded (or vehicle wasn't synced)
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: "Fordon borttaget",
        description: `${registrationNumber} har tagits bort från lagret.`,
      });

      // Reload the vehicles list
      loadVehicles();
      // Update stats in parent component
      onStatsUpdate?.();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      toast({
        title: "Fel",
        description: `Kunde inte ta bort fordonet. ${error.message || 'Försök igen.'}`,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTestConnection = async () => {
    try {
      setSyncingId('test');
      
      const { data, error } = await supabase.functions.invoke('fortnox-test-connection');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Fortnox-anslutning OK",
          description: `Anslutning till Fortnox fungerar. API status: ${data.api_response_status}`,
        });
      } else {
        toast({
          title: "Fortnox-anslutning misslyckades",
          description: data?.message || 'Okänt fel vid test av anslutning',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Anslutningstest misslyckades",
        description: `Kunde inte testa Fortnox-anslutning: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleSync = async (vehicleId: string, registrationNumber: string) => {
    try {
      setSyncingId(vehicleId);
      
      // Find the vehicle to check its vat_type
      const vehicle = vehicles.find(v => v.id === vehicleId);
      
      if (!vehicle) {
        throw new Error('Fordon hittades inte');
      }

      let response;
      let functionName: string;
      let successMessage: string;
      
      // Call appropriate function based on vat_type
      if (vehicle.vat_type === 'VMB') {
        functionName = 'fortnox-vmb-inkop';
        successMessage = 'VMB projekt har skapats i Fortnox';
        console.log('Syncing VMB vehicle:', { vehicleId, registrationNumber, userId: user?.id });
      } else if (vehicle.vat_type === 'MOMS') {
        functionName = 'fortnox-moms-inkop';
        successMessage = 'MOMS inköp har synkats i Fortnox';
        console.log('Syncing MOMS vehicle:', { vehicleId, registrationNumber, userId: user?.id });
      } else if (vehicle.vat_type === 'VMBI') {
        functionName = 'fortnox-vmbi-inkop';
        successMessage = 'VMBI (Import VMB) inköp har synkats i Fortnox';
        console.log('Syncing VMBI vehicle:', { vehicleId, registrationNumber, userId: user?.id });
      } else if (vehicle.vat_type === 'MOMSI') {
        functionName = 'fortnox-momsi-inkop';
        successMessage = 'MOMSI (Import Moms) inköp har synkats i Fortnox';
        console.log('Syncing MOMSI vehicle:', { vehicleId, registrationNumber, userId: user?.id });
      } else {
        toast({
          title: "Synkronisering ej tillgänglig",
          description: `Synkronisering är endast tillgänglig för VMB, MOMS, VMBI och MOMSI fordon. ${registrationNumber} har moms-typ: ${vehicle.vat_type || 'okänd'}.`,
          variant: "destructive",
        });
        return;
      }

      try {
        response = await supabase.functions.invoke(functionName, {
          body: { 
            inventoryItemId: vehicleId,
            syncingUserId: user?.id
          }
        });
        console.log(`Full ${functionName} response:`, JSON.stringify(response, null, 2));
      } catch (functionError) {
        console.error('Function invoke error:', functionError);
        throw new Error(functionError.message || 'Kunde inte anropa Fortnox funktionen');
      }

      const { data, error } = response;
      console.log('Response data:', data);
      console.log('Response error:', error);

      // Check for function invoke errors first
      if (error) {
        console.error('Sync error object:', error);
        
        // Check if error has a message property
        if (error.message) {
          throw new Error(error.message);
        }
        
        // Check if error is a string
        if (typeof error === 'string') {
          throw new Error(error);
        }
        
        // Check if error contains context about the actual error
        if (error.context) {
          throw new Error(JSON.stringify(error.context));
        }
        
        throw new Error(JSON.stringify(error));
      }

      // Check if the response contains an error (from non-2xx status codes)
      if (data?.error) {
        console.error('Sync failed with error:', data);
        throw new Error(data.error);
      }

      // Check for success
      if (data?.success) {
        toast({
          title: "Synkronisering klar",
          description: `${successMessage} för ${registrationNumber}.`,
        });
        
        // Reload vehicles to show updated sync status
        loadVehicles();
      } else {
        console.error('Sync unexpected response:', data);
        // If no explicit error but no success either, try to extract any error message
        const errorMsg = data?.message || data?.details || JSON.stringify(data) || 'Okänt fel vid synkronisering';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error syncing vehicle:', error);
      
      // More detailed error message
      let errorMessage = 'Kunde inte synkronisera med Fortnox. Försök igen.';
      if (error.message?.includes('No active Fortnox integration')) {
        errorMessage = 'Ingen aktiv Fortnox-anslutning. Gå till Integrationer för att ansluta till Fortnox.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Synkroniseringsfel",
        description: `${registrationNumber}: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };


  const handleView = (vehicleId: string) => {
    // Navigate to vehicle details page
    window.location.href = `/vehicle/${vehicleId}`;
  };

  const handleOpenFortnoxVoucher = async (verificationNumber: string) => {
    
    
    try {
      // Get the user's Fortnox integration to find their company ID
      const { data: fortnoxIntegrations, error } = await supabase
        .from('fortnox_integrations')
        .select('fortnox_company_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      

      if (error) {
        console.error('❌ Database error:', error);
        return;
      }

      if (!fortnoxIntegrations || fortnoxIntegrations.length === 0) {
        console.error('❌ No active Fortnox integrations found');
        return;
      }

      // Find the first integration that has a company ID
      const fortnoxIntegration = fortnoxIntegrations.find(integration => integration.fortnox_company_id);
      
      
      if (!fortnoxIntegration || !fortnoxIntegration.fortnox_company_id) {
        console.error('❌ Fortnox company ID is missing - please reconnect to Fortnox');
        return;
      }

      const fortnoxUrl = `https://apps5.fortnox.se/app/${fortnoxIntegration.fortnox_company_id}/bf/voucher/A-${verificationNumber}`;
      
      
      window.open(fortnoxUrl, 'fortnox-voucher', 'width=1200,height=800,scrollbars=yes,resizable=yes');
      
      
    } catch (error) {
      console.error('❌ Error opening Fortnox voucher:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Laddar fordon...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter vehicles based on search term
  const filteredVehicles = vehicles.filter(vehicle => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const registrationMatch = vehicle.registration_number.toLowerCase().includes(searchLower);
    const brandMatch = vehicle.brand.toLowerCase().includes(searchLower);
    const modelMatch = vehicle.model?.toLowerCase().includes(searchLower) || false;
    
    return registrationMatch || brandMatch || modelMatch;
  });

  // Sort vehicles based on sortField and sortOrder
  const sortedVehicles = [...filteredVehicles].sort((a, b) => {
    let valueA: number;
    let valueB: number;
    
    switch (sortField) {
      case 'storage-days':
        valueA = calculateStorageDays(a.purchase_date, a.status, a.selling_date);
        valueB = calculateStorageDays(b.purchase_date, b.status, b.selling_date);
        break;
      case 'purchase-price':
        valueA = a.purchase_price;
        valueB = b.purchase_price;
        break;
      case 'selling-price':
        valueA = a.selling_price || 0;
        valueB = b.selling_price || 0;
        break;
      case 'gross-profit':
        valueA = (a.selling_price || 0) - a.purchase_price;
        valueB = (b.selling_price || 0) - b.purchase_price;
        break;
      default:
        return 0;
    }
    
    if (sortOrder === 'desc') {
      return valueB - valueA; // Descending (högst till lägst)
    } else {
      return valueA - valueB; // Ascending (lägst till högst)
    }
  });

  return (
    <Card className="border-0">
      <CardContent className="px-0">
        {sortedVehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm.trim() ? `Inga fordon hittades för "${searchTerm}".` : "Inga fordon registrerade än."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedVehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center gap-4 py-4 border rounded-lg hover:bg-muted/50 transition-colors w-full">
                {/* Car icon or brand logo */}
                <div className="flex-shrink-0 w-16 flex justify-start items-center pl-4">
                  <BrandLogo 
                    brandName={vehicle.brand} 
                    className="h-12 w-12" 
                    fallbackClassName="h-12 w-12"
                  />
                </div>
                
                 {/* Vehicle main info */}
                 <div className="flex-1 grid grid-cols-8 gap-4 items-center text-sm">
                   {/* Column 1: Brand & Model + Registration */}
                   <div className="col-span-2">
                     <h3 className="font-medium truncate" title={`${vehicle.brand} ${vehicle.model || ''}`}>
                       {vehicle.brand} {vehicle.model || ''}
                     </h3>
                     <p className="text-sm text-muted-foreground">
                       {vehicle.registration_number}
                     </p>
                   </div>
                   
                   {/* Column 2: Status */}
                   <div className="text-center">
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Status</p>
                     <Badge 
                       variant={getStatusVariant(vehicle.status)} 
                       className={`text-xs whitespace-nowrap px-2 justify-center w-20 ${
                         vehicle.status === 'på_lager' 
                           ? 'border-blue-500 text-blue-500 hover:border-blue-600 hover:text-blue-600' 
                           : vehicle.status === 'såld'
                           ? 'bg-green-500 hover:bg-green-600 text-white'
                           : ''
                       }`}
                    >
                     {getStatusLabel(vehicle.status)}
                   </Badge>
                   </div>

                   {/* Column 3: Status 2 (Fortnox) */}
                   <div className="text-center">
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Bokföring</p>
                      {vehicle.fortnox_sync_status && (
                        <Badge 
                          variant="outline"
                          className={`text-xs px-1 w-20 justify-center whitespace-nowrap cursor-pointer ${
                            vehicle.fortnox_sync_status === 'synced' 
                              ? 'border-green-500 text-green-700 bg-green-50 hover:bg-green-100' 
                              : vehicle.fortnox_sync_status === 'failed'
                              ? 'border-gray-500 text-gray-700 bg-gray-50'
                              : 'border-orange-500 text-orange-700 bg-orange-50'
                          }`}
                          title={vehicle.fortnox_verification_number ? `Verifikation: ${vehicle.fortnox_verification_number}` : undefined}
                          onClick={() => {
                            if (vehicle.fortnox_sync_status === 'synced' && vehicle.fortnox_verification_number) {
                              handleOpenFortnoxVoucher(vehicle.fortnox_verification_number);
                            }
                          }}
                        >
                           {vehicle.fortnox_sync_status === 'synced' ? 'Bokförd' : 
                            vehicle.fortnox_sync_status === 'failed' ? 'Ej syncat' : 'Inte bokförd'}
                        </Badge>
                      )}
                   </div>
                   
                   {/* Column 4: Storage Days */}
                   <div>
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Lagerdagar</p>
                     <p className="font-medium text-sm whitespace-nowrap">{calculateStorageDays(vehicle.purchase_date, vehicle.status, vehicle.selling_date)} dagar</p>
                   </div>
                   
                   {/* Column 5: VAT Type */}
                   <div>
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Momstyp</p>
                     <p className="font-medium whitespace-nowrap">{vehicle.vat_type === "Vinstmarginalbeskattning (VMB)" ? "VMB" : vehicle.vat_type || "Ej angiven"}</p>
                   </div>
                   
                   {/* Column 6: Registered By (Inköpare) */}
                   <div>
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpare</p>
                     <p className="font-medium whitespace-nowrap text-sm" title={vehicle.registered_by}>
                       {formatPurchaserName(vehicle.registered_by || 'Okänd')}
                     </p>
                   </div>
                   
                    {/* Column 7: Purchase Price */}
                    <div className="w-16">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpspris</p>
                      <p className="font-medium">{formatPrice(vehicle.purchase_price)}</p>
                    </div>
                 </div>
                
                {/* Action buttons */}
                <div className="flex-shrink-0 flex gap-2 pr-[1rem]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(vehicle.id)}
                    className="text-primary hover:bg-primary hover:text-primary-foreground w-10 h-10 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {/* Always show sync button but grey out if synced */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(vehicle.id, vehicle.registration_number)}
                    disabled={syncingId === vehicle.id || vehicle.fortnox_sync_status === 'synced'}
                    className={`w-10 h-10 p-0 ${
                      vehicle.fortnox_sync_status === 'synced'
                        ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-400 cursor-not-allowed'
                        : 'text-blue-600 hover:bg-blue-600 hover:text-white'
                    }`}
                    title={vehicle.fortnox_sync_status === 'synced' ? 'Redan synkroniserad med Fortnox' : 'Synkronisera med Fortnox'}
                  >
                    {syncingId === vehicle.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>

                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSellVehicle?.(vehicle.id)}
                    className="text-green-600 hover:bg-green-600 hover:text-white w-10 h-10 p-0"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(vehicle.id, vehicle.registration_number)}
                    disabled={deletingId === vehicle.id}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground w-10 h-10 p-0"
                  >
                    {deletingId === vehicle.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
