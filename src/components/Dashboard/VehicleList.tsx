import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  purchase_date: string;
  purchaser: string;
  purchase_price: number;
  status: string;
}

export const VehicleList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user]);

  // Update current time every minute to keep lagerdagar current
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const loadVehicles = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, purchase_date, purchaser, purchase_price, status')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

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
        return 'På lager';
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
    const purchase = new Date(purchaseDate);
    const diffTime = Math.abs(currentTime.getTime() - purchase.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
        <CardHeader>
          <CardTitle>Fordon</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Laddar fordon...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrerade fordon</CardTitle>
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Inga fordon registrerade än.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors w-full">
                {/* Car icon or Tesla logo */}
                <div className="flex-shrink-0 w-16 flex justify-center items-center">
                  {vehicle.brand.toLowerCase() === 'tesla' ? (
                     <img 
                       src="/lovable-uploads/7cabba07-206a-4755-b690-eed0738888de.png" 
                       alt="Tesla logo" 
                       className="h-12 w-12 object-contain"
                     />
                  ) : vehicle.brand.toLowerCase() === 'aston martin' ? (
                     <img 
                       src="/lovable-uploads/eac64da7-3b14-4cba-8714-fc5441349d8d.png" 
                       alt="Aston Martin logo" 
                       className="h-12 w-12 object-contain"
                     />
                   ) : (
                     <Car className="h-12 w-12 text-muted-foreground" />
                   )}
                </div>
                
                {/* Vehicle main info */}
                <div className="flex-1 grid grid-cols-7 gap-3 items-center text-sm">
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
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Status</p>
                    <div className="flex justify-center">
                      <Badge 
                        variant={getStatusVariant(vehicle.status)} 
                        className={`text-xs whitespace-nowrap px-2 justify-center ${
                          vehicle.status === 'på_lager' 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : ''
                        }`}
                      >
                        {getStatusLabel(vehicle.status)}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Column 3: Purchase Date */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpsdatum</p>
                    <p className="font-medium text-sm">{formatDate(vehicle.purchase_date)}</p>
                  </div>
                  
                  {/* Column 4: Purchaser */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpare</p>
                    <p className="font-medium">{formatPurchaserName(vehicle.purchaser)}</p>
                  </div>
                  
                  {/* Column 5: Purchase Price */}
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">Inköpspris</p>
                    <p className="font-medium">{formatPrice(vehicle.purchase_price)}</p>
                  </div>
                  
                  {/* Column 6: Storage Days */}
                  <div className="text-center">
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
                    className="text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Visa
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(vehicle.id, vehicle.registration_number)}
                    disabled={deletingId === vehicle.id}
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {deletingId === vehicle.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Ta bort
                      </>
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