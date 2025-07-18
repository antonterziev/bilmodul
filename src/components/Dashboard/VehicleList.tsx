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
                
                {/* Vehicle info */}
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-sm">
                      {vehicle.brand} {vehicle.model || ''}
                    </h3>
                    <Badge variant={getStatusVariant(vehicle.status)} className="text-xs">
                      {getStatusLabel(vehicle.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {vehicle.registration_number}
                  </p>
                  
                  {/* Additional details in two rows - aligned with brand/model */}
                  <div className="space-y-1 text-xs w-full">
                    <div className="flex gap-8 w-full">
                      <div className="flex-1">
                        <span className="text-muted-foreground">Inköpsdatum: </span>
                        <span>{formatDate(vehicle.purchase_date)}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-muted-foreground">Inköpare: </span>
                        <span>{vehicle.purchaser}</span>
                      </div>
                    </div>
                    <div className="flex gap-8 w-full">
                      <div className="flex-1">
                        <span className="text-muted-foreground">Inköpspris: </span>
                        <span>{formatPrice(vehicle.purchase_price)}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-muted-foreground">Lagerdagar: </span>
                        <span>{calculateStorageDays(vehicle.purchase_date)} dagar</span>
                      </div>
                    </div>
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