import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user]);

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
        return 'default';
      case 'på_väg':
        return 'secondary';
      case 'såld':
        return 'outline';
      default:
        return 'default';
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
    const today = new Date();
    const purchase = new Date(purchaseDate);
    const diffTime = Math.abs(today.getTime() - purchase.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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
                {/* Car icon */}
                <div className="flex-shrink-0">
                  <Car className="h-8 w-8 text-muted-foreground" />
                </div>
                
                {/* Vehicle main info */}
                <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm">
                  {/* Column 1: Brand & Model + Registration */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">
                        {vehicle.brand} {vehicle.model || ''}
                      </h3>
                      <Badge variant={getStatusVariant(vehicle.status)} className="text-xs">
                        {getStatusLabel(vehicle.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.registration_number}
                    </p>
                  </div>
                  
                  {/* Column 2: Purchase Date */}
                  <div>
                    <p className="text-xs text-muted-foreground">Inköpsdatum</p>
                    <p className="font-medium">{formatDate(vehicle.purchase_date)}</p>
                  </div>
                  
                  {/* Column 3: Purchaser */}
                  <div>
                    <p className="text-xs text-muted-foreground">Inköpare</p>
                    <p className="font-medium">{vehicle.purchaser}</p>
                  </div>
                  
                  {/* Column 4: Purchase Price */}
                  <div>
                    <p className="text-xs text-muted-foreground">Inköpspris</p>
                    <p className="font-medium">{formatPrice(vehicle.purchase_price)}</p>
                  </div>
                  
                  {/* Column 5: Storage Days */}
                  <div>
                    <p className="text-xs text-muted-foreground">Lagerdagar</p>
                    <p className="font-medium">{calculateStorageDays(vehicle.purchase_date)} dagar</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};