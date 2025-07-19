import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Trash2, Eye, DollarSign } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  purchase_date: string;
  purchaser: string;
  purchase_price: number;
  expected_selling_price: number | null;
  status: string;
}

interface VehicleListProps {
  filter?: 'all' | 'på_lager' | 'såld' | 'transport';
  onSellVehicle?: (vehicleId: string) => void;
  onStatsUpdate?: () => void;
  searchTerm?: string;
}

export const VehicleList = ({ filter = 'all', onSellVehicle, onStatsUpdate, searchTerm = "" }: VehicleListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user, filter]);

  // Force re-render at midnight each day to keep lagerdagar current
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Set timeout for midnight, then interval for every 24 hours
    const midnightTimeout = setTimeout(() => {
      setForceUpdate(prev => prev + 1);
      
      // Set interval for every 24 hours after the first midnight update
      const dailyInterval = setInterval(() => {
        setForceUpdate(prev => prev + 1);
      }, 24 * 60 * 60 * 1000); // 24 hours
      
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, []);

  const loadVehicles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, purchase_date, purchaser, purchase_price, expected_selling_price, status')
        .eq('user_id', user.id);

      // Apply status filter if not 'all'
      if (filter !== 'all') {
        if (filter === 'transport') {
          query = query.eq('status', 'på_väg');
        } else {
          query = query.eq('status', filter);
        }
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
        return 'default' as const; // Will be styled green with custom CSS
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

  const calculateStorageDays = (purchaseDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of today
    
    const purchase = new Date(purchaseDate);
    purchase.setHours(0, 0, 0, 0); // Reset to start of purchase day
    
    const diffTime = today.getTime() - purchase.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1); // Ensure minimum 1 day, add 1 to show day 1 when purchased today
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

  return (
    <Card>
      <CardContent className="p-6">
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm.trim() ? `Inga fordon hittades för "${searchTerm}".` : "Inga fordon registrerade än."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors w-full">
                {/* Car icon or brand logo */}
                <div className="flex-shrink-0 w-16 flex justify-center items-center">
                  <BrandLogo 
                    brandName={vehicle.brand} 
                    className="h-12 w-12" 
                    fallbackClassName="h-12 w-12"
                  />
                </div>
                
                {/* Vehicle main info */}
                <div className="flex-1 grid grid-cols-9 gap-3 items-center text-sm">
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
                  
                  {/* Column 2: Status */}
                  <div className="text-center -ml-4">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Status</p>
                    <div className="flex justify-center">
                       <Badge 
                         variant={getStatusVariant(vehicle.status)} 
                         className={`text-xs whitespace-nowrap px-2 justify-center w-16 ${
                           vehicle.status === 'på_lager' 
                             ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                             : vehicle.status === 'såld'
                             ? 'bg-green-500 hover:bg-green-600 text-white'
                             : ''
                         }`}
                       >
                        {getStatusLabel(vehicle.status)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Column 3: Purchase Date */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpsdatum</p>
                    <p className="font-medium text-sm whitespace-nowrap">{formatDate(vehicle.purchase_date)}</p>
                  </div>
                  
                  {/* Column 4: Purchaser */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpare</p>
                    <p className="font-medium">{formatPurchaserName(vehicle.purchaser)}</p>
                  </div>
                  
                  {/* Column 5: Purchase Price */}
                  <div>
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
                  
                  {/* Column 8: Storage Days */}
                  <div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Lagerdagar</p>
                    <p className="font-medium">{calculateStorageDays(vehicle.purchase_date)} dagar</p>
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex-shrink-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(vehicle.id)}
                    className="text-primary hover:bg-primary hover:text-primary-foreground w-10 h-10 p-0"
                  >
                    <Eye className="h-4 w-4" />
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