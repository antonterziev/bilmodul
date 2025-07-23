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
  expected_selling_price: number | null;
  status: string;
  fortnox_sync_status?: string;
  fortnox_verification_number?: string;
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
      let query = supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, purchase_date, selling_date, purchaser, purchase_price, expected_selling_price, status, fortnox_sync_status, fortnox_verification_number')
        .eq('user_id', user.id);

      // Apply status filter if not 'all'
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('purchase_date', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
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
      
      // If synced with Fortnox, delete the voucher first
      if (vehicle?.fortnox_sync_status === 'synced' && vehicle?.fortnox_verification_number) {
        try {
          const { data, error } = await supabase.functions.invoke('fortnox-delete-voucher', {
            body: { inventoryItemId: vehicleId }
          });

          if (error) throw error;

          if (!data?.success) {
            throw new Error(data?.error || 'Okänt fel vid borttagning från Fortnox');
          }

          toast({
            title: "Fortnox-synkronisering uppdaterad",
            description: `Verifikation ${vehicle.fortnox_verification_number} har tagits bort från Fortnox.`,
          });
        } catch (fortnoxError) {
          console.error('Error deleting from Fortnox:', fortnoxError);
          toast({
            title: "Varning",
            description: `Kunde inte ta bort verifikationen från Fortnox: ${fortnoxError.message}. Fordonet kommer ändå att tas bort från lagret.`,
            variant: "destructive",
          });
        }
      }

      // Then delete the vehicle from local database
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', vehicleId)
        .eq('user_id', user?.id);

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
        description: "Kunde inte ta bort fordonet. Försök igen.",
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
      
      const { data, error } = await supabase.functions.invoke('fortnox-sync-purchase', {
        body: { inventoryItemId: vehicleId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Synkronisering lyckad",
          description: `${registrationNumber} har synkroniserats med Fortnox.`,
        });
        
        // Reload vehicles to show updated sync status
        loadVehicles();
      } else {
        throw new Error(data?.error || 'Okänt fel vid synkronisering');
      }
    } catch (error) {
      console.error('Error syncing vehicle:', error);
      toast({
        title: "Synkroniseringsfel",
        description: `Kunde inte synkronisera ${registrationNumber} med Fortnox. Försök igen.`,
        variant: "destructive",
      });
    } finally {
      setSyncingId(null);
    }
  };

  const handleView = (vehicleId: string) => {
    // For now, just show a toast. This could navigate to a detail view later
    toast({
      title: "Visa fordon",
      description: "Fordonsdetaljer visas här i framtiden.",
    });
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
        valueA = a.expected_selling_price || 0;
        valueB = b.expected_selling_price || 0;
        break;
      case 'gross-profit':
        valueA = (a.expected_selling_price || 0) - a.purchase_price;
        valueB = (b.expected_selling_price || 0) - b.purchase_price;
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
                <div className="flex-1 grid grid-cols-8 gap-3 items-center text-sm">
                  {/* Column 1: Brand & Model + Registration */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">
                        {vehicle.brand} {vehicle.model || ''}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.registration_number}
                    </p>
                  </div>
                  
                  {/* Column 2: Status & Fortnox */}
                  <div className="text-center -ml-4">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Status</p>
                    <div className="flex flex-col gap-1 items-center">
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
                       {vehicle.fortnox_sync_status && (
                         <Badge 
                           variant="outline"
                           className={`text-xs px-1 w-20 justify-center whitespace-nowrap ${
                             vehicle.fortnox_sync_status === 'synced' 
                               ? 'border-green-500 text-green-700 bg-green-50' 
                               : vehicle.fortnox_sync_status === 'failed'
                               ? 'border-gray-500 text-gray-700 bg-gray-50'
                               : 'border-orange-500 text-orange-700 bg-orange-50'
                           }`}
                           title={vehicle.fortnox_verification_number ? `Verifikation: ${vehicle.fortnox_verification_number}` : undefined}
                         >
                            {vehicle.fortnox_sync_status === 'synced' ? 'Bokförd' : 
                             vehicle.fortnox_sync_status === 'failed' ? 'Ej bokförd' : '⏳ F'}
                         </Badge>
                       )}
                    </div>
                  </div>
                  
                  {/* Column 3: Storage Days */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Lagerdagar</p>
                    <p className="font-medium text-sm whitespace-nowrap">{calculateStorageDays(vehicle.purchase_date, vehicle.status, vehicle.selling_date)} dagar</p>
                  </div>
                  
                  {/* Column 4: Purchaser */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpare</p>
                    <p className="font-medium">{formatPurchaserName(vehicle.purchaser)}</p>
                  </div>
                  
                   {/* Column 5: Purchase Price */}
                   <div className="w-16">
                     <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpspris</p>
                     <p className="font-medium">{formatPrice(vehicle.purchase_price)}</p>
                   </div>
                  
                  {/* Column 6: Expected Selling Price */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Utpris</p>
                    <p className="font-medium">
                      {vehicle.expected_selling_price ? formatPrice(vehicle.expected_selling_price) : "-"}
                    </p>
                  </div>
                  
                  {/* Column 7: Gross Profit */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Bruttovinst</p>
                    <p className={`font-medium ${
                      vehicle.expected_selling_price && (vehicle.expected_selling_price - vehicle.purchase_price) < 0 
                        ? 'text-red-600' 
                        : vehicle.expected_selling_price && (vehicle.expected_selling_price - vehicle.purchase_price) > 0
                        ? 'text-green-600'
                        : ''
                    }`}>
                      {vehicle.expected_selling_price 
                        ? formatPrice(vehicle.expected_selling_price - vehicle.purchase_price)
                        : "-"}
                    </p>
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
