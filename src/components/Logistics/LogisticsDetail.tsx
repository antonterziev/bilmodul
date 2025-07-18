import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

interface Vehicle {
  id: string;
  registration_number: string;
  chassis_number: string;
  brand: string;
  model: string;
  year_model: number;
  purchaser: string;
  purchase_date: string;
  purchase_price: number;
  status: string;
  current_location: string;
  additional_costs: number;
  logistics_documentation_attached: boolean;
  logistics_notes: string;
}

interface LogisticsDetailProps {
  vehicleId: string;
  onBack: () => void;
}

export const LogisticsDetail = ({ vehicleId, onBack }: LogisticsDetailProps) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [currentLocation, setCurrentLocation] = useState("");
  const [status, setStatus] = useState("");
  const [additionalCosts, setAdditionalCosts] = useState("");
  const [documentationAttached, setDocumentationAttached] = useState(false);
  const [logisticsNotes, setLogisticsNotes] = useState("");

  useEffect(() => {
    loadVehicle();
  }, [vehicleId]);

  const loadVehicle = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      
      setVehicle(data);
      setCurrentLocation(data.current_location || "Täby");
      setStatus(data.status || "på_lager");
      setAdditionalCosts(data.additional_costs?.toString() || "0");
      setDocumentationAttached(data.logistics_documentation_attached || false);
      setLogisticsNotes(data.logistics_notes || "");
    } catch (error) {
      console.error('Error loading vehicle:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda fordonsinformation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({
          current_location: currentLocation,
          status: status,
          additional_costs: parseFloat(additionalCosts) || 0,
          logistics_documentation_attached: documentationAttached,
          logistics_notes: logisticsNotes,
        })
        .eq('id', vehicleId);

      if (error) throw error;

      toast({
        title: "Sparat",
        description: "Logistikinformation har uppdaterats",
      });
      
      loadVehicle(); // Refresh data
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara ändringar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Laddar fordonsinformation...</div>;
  }

  if (!vehicle) {
    return <div>Fordon hittades inte</div>;
  }

  const totalCosts = (vehicle.purchase_price || 0) + (parseFloat(additionalCosts) || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tillbaka
        </Button>
        <h2 className="text-2xl font-bold">Logistik & Administration</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vehicle Data */}
        <Card>
          <CardHeader>
            <CardTitle>Fordonsdata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Reg / Chassinummer</Label>
              <div className="font-semibold p-2 bg-yellow-100 border rounded">
                {vehicle.registration_number}
              </div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Inköpare</Label>
              <div>{vehicle.purchaser}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Inköpsdatum</Label>
              <div>{new Date(vehicle.purchase_date).toLocaleDateString('sv-SE')}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Bilmärke</Label>
              <div>{vehicle.brand}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Modell</Label>
              <div>{vehicle.model}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Årsmodell</Label>
              <div>{vehicle.year_model}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Nuvarande lagerplats</Label>
              <div>{currentLocation}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Nuvarande status</Label>
              <div>{status}</div>
            </div>
            
            <div>
              <Label className="text-sm text-muted-foreground">Total påkostnad</Label>
              <div className="font-semibold">{totalCosts.toLocaleString('sv-SE')}</div>
            </div>
          </CardContent>
        </Card>

        {/* Logistics & Administration */}
        <Card>
          <CardHeader>
            <CardTitle>Logistik & Administration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="location">Lagerplats</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Input
                  id="location"
                  value={currentLocation}
                  onChange={(e) => setCurrentLocation(e.target.value)}
                  className="border-0 bg-transparent p-0"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="border-0 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="på_lager">På lager</SelectItem>
                    <SelectItem value="på_väg">På väg</SelectItem>
                    <SelectItem value="såld">Såld</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="costs">Total påkostnad</Label>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yellow-100 border rounded flex-1">
                  <Input
                    id="costs"
                    value={additionalCosts}
                    onChange={(e) => setAdditionalCosts(e.target.value)}
                    type="number"
                    className="border-0 bg-transparent p-0"
                  />
                </div>
                <span>SEK</span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="documentation">Underlag påkostnad(er) bifogat?</Label>
              <div className="p-2 bg-yellow-100 border rounded">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="documentation"
                    checked={documentationAttached}
                    onCheckedChange={(checked) => setDocumentationAttached(checked as boolean)}
                  />
                  <Label htmlFor="documentation">Ja</Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Anteckningar</Label>
              <Textarea
                id="notes"
                value={logisticsNotes}
                onChange={(e) => setLogisticsNotes(e.target.value)}
                placeholder="Lägg till anteckningar..."
                rows={3}
              />
            </div>
            
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full"
            >
              {saving ? "Sparar..." : "Registrera logistik"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};