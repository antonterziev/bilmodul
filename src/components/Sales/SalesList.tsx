import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart } from "lucide-react";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
  status: string;
  current_location: string;
  purchase_price: number;
  additional_costs: number;
  expected_selling_price: number;
  purchaser: string;
  purchase_date: string;
}

interface SalesListProps {
  onSellVehicle: (vehicleId: string) => void;
}

export const SalesList = ({ onSellVehicle }: SalesListProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadAvailableVehicles();
    }
  }, [user]);

  const loadAvailableVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .in('status', ['på_lager', 'på_väg'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'på_lager': return 'bg-green-500';
      case 'på_väg': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getTotalCost = (vehicle: Vehicle) => {
    return (vehicle.purchase_price || 0) + (vehicle.additional_costs || 0);
  };

  const getPotentialProfit = (vehicle: Vehicle) => {
    const totalCost = getTotalCost(vehicle);
    const expectedSelling = vehicle.expected_selling_price || 0;
    return expectedSelling - totalCost;
  };

  if (loading) {
    return <div>Laddar fordon...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Försäljning</h2>
        <p className="text-muted-foreground">
          {vehicles.length} fordon tillgängliga för försäljning
        </p>
      </div>

      <div className="grid gap-4">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                <div>
                  <div className="font-semibold">{vehicle.registration_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {vehicle.brand} {vehicle.model}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground">Inköpare</div>
                  <div>{vehicle.purchaser}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Lagerplats</div>
                  <div>{vehicle.current_location}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge className={`${getStatusColor(vehicle.status)} text-white`}>
                    {vehicle.status}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Total kostnad</div>
                  <div className="font-semibold">
                    {getTotalCost(vehicle).toLocaleString('sv-SE')} SEK
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Förväntad vinst</div>
                  <div className={`font-semibold ${getPotentialProfit(vehicle) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {getPotentialProfit(vehicle).toLocaleString('sv-SE')} SEK
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => onSellVehicle(vehicle.id)}
                    size="sm"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Sälj
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Inga fordon tillgängliga för försäljning.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};