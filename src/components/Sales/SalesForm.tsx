import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string;
  year_model?: number;
}

interface SalesFormProps {
  vehicleId?: string;
  onBack?: () => void;
  onSuccess?: () => void;
}

export const SalesForm = ({ vehicleId, onBack, onSuccess }: SalesFormProps) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [seller, setSeller] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [sellingDate, setSellingDate] = useState<Date | undefined>(new Date());
  const [hasWarranty, setHasWarranty] = useState(false);
  const [hasFinance, setHasFinance] = useState(false);
  const [salesDocumentation, setSalesDocumentation] = useState("Köpeavtal");
  const [salesChannel, setSalesChannel] = useState("Bilhall");
  const [customerType, setCustomerType] = useState("Företag");
  const [customerCountry, setCustomerCountry] = useState("Sverige");

  useEffect(() => {
    if (vehicleId) {
      loadVehicle();
    } else {
      setLoading(false);
    }
    loadUserProfile();
  }, [vehicleId, user]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      const userName = data.full_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Okänd användare';
      setSeller(userName);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadVehicle = async () => {
    if (!vehicleId) return;
    
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, year_model')
        .eq('id', vehicleId)
        .single();

      if (error) throw error;
      setVehicle(data);
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

  if (loading) {
    return <div>Laddar fordonsinformation...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Försäljning</h1>
          {vehicle && (
            <h2 className="text-xl text-muted-foreground mt-2">
              {vehicle.brand} {vehicle.model} {vehicle.year_model && `(${vehicle.year_model})`}
            </h2>
          )}
        </div>
        {onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Button>
        )}
      </div>
      
      <Card className="bg-card border rounded-lg">
        <CardHeader>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="seller">Säljare</Label>
                    <Input
                      id="seller"
                      value={seller}
                      onChange={(e) => setSeller(e.target.value)}
                      placeholder="Johan Nilsson"
                    />
                  </div>
                  <div>
                    <Label>Försäljningsdatum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !sellingDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {sellingDate ? format(sellingDate, "dd/MM/yyyy") : <span>Välj datum</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={sellingDate}
                          onSelect={setSellingDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <Label htmlFor="price">Säljpris bil (ink. moms)</Label>
                  <Input
                    id="price"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    type="number"
                    placeholder="130,000"
                  />
                </div>

                <div>
                  <Label>Garanti</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="warranty"
                      checked={hasWarranty}
                      onCheckedChange={(checked) => setHasWarranty(checked as boolean)}
                    />
                    <Label htmlFor="warranty">Ja</Label>
                  </div>
                </div>

                <div>
                  <Label>Finans</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="finance"
                      checked={hasFinance}
                      onCheckedChange={(checked) => setHasFinance(checked as boolean)}
                    />
                    <Label htmlFor="finance">Ja</Label>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="documentation">Säljunderlag</Label>
                  <Select value={salesDocumentation} onValueChange={setSalesDocumentation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj säljunderlag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Köpeavtal">Köpeavtal</SelectItem>
                      <SelectItem value="Faktura">Faktura</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="channel">Säljkanal</Label>
                  <Select value={salesChannel} onValueChange={setSalesChannel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj säljkanal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bilhall">Bilhall</SelectItem>
                      <SelectItem value="Blocket">Blocket</SelectItem>
                      <SelectItem value="Annan">Annan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="customerType">Kundtyp</Label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj kundtyp" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Företag">Företag</SelectItem>
                      <SelectItem value="Privatperson">Privatperson</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="country">Kunds land</Label>
                  <Select value={customerCountry} onValueChange={setCustomerCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj land" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sverige">Sverige</SelectItem>
                      <SelectItem value="EU">EU</SelectItem>
                      <SelectItem value="Utanför EU">Utanför EU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? "Sparar..." : "Spara försäljning"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};