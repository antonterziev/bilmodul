
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye } from "lucide-react";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string | null;
  model: string | null;
  year_model: number | null;
  status: string;
  current_location: string;
  purchase_price: number;
  additional_costs: number;
  purchaser: string;
  purchase_date: string;
}

interface LogisticsListProps {
  onViewVehicle: (vehicleId: string) => void;
}

export const LogisticsList = ({ onViewVehicle }: LogisticsListProps) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadVehicles();
    }
  }, [user]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
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
      case 'såld': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTotalCost = (vehicle: Vehicle) => {
    return (vehicle.purchase_price || 0) + (vehicle.additional_costs || 0);
  };

  // Display "Saknas" for missing brand, model, or year
  const getVehicleInfo = (vehicle: Vehicle) => {
    const brand = vehicle.brand || "Saknas";
    const model = vehicle.model || "Saknas";
    return `${brand} ${model}`;
  };

  if (loading) {
    return <div>Laddar fordon...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div>
                  <div className="font-semibold">{vehicle.registration_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {getVehicleInfo(vehicle)}
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
                  <div className="text-sm text-muted-foreground">Total påkostnad</div>
                  <div className="font-semibold">
                    {getTotalCost(vehicle).toLocaleString('sv-SE')} SEK
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewVehicle(vehicle.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vehicles.length === 0 && (
        <Card>
          <CardContent className="pt-0 p-6 text-center">
            <p className="text-muted-foreground">Inga fordon registrerade än.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
