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
  const [priceDisplay, setPriceDisplay] = useState("");
  const [sellingDate, setSellingDate] = useState<Date | undefined>(new Date());
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

  // Format price with thousands separator and decimals
  const formatPriceWithThousands = (value: string) => {
    // Remove existing formatting
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    if (!cleanValue) return '';
    
    const num = parseFloat(cleanValue);
    if (isNaN(num)) return value;
    
    // Format with Swedish locale (space as thousand separator)
    return num.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Handle price input change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow digits, comma, and decimal point
    const cleanValue = value.replace(/\s/g, '').replace(/,/g, '.');
    
    if (cleanValue === '' || /^\d+([.,]\d{0,2})?$/.test(cleanValue)) {
      const numValue = cleanValue === '' ? undefined : parseFloat(cleanValue);
      if (numValue === undefined || numValue >= 0) {
        setSellingPrice(numValue?.toString() || '');
        setPriceDisplay(value === '' ? '' : formatPriceWithThousands(value));
      }
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
      </div>
      
      <Card className="bg-card border rounded-lg">
        <CardHeader>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Row 1: Säljare and Försäljningsdatum */}
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

            {/* Row 2: Försäljningspris and Säljunderlag */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Försäljningspris (inkl. moms)</Label>
                <Input
                  id="price"
                  type="text"
                  value={priceDisplay}
                  onChange={handlePriceChange}
                  placeholder="t.ex. 130 000"
                />
              </div>
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
            </div>

            {/* Row 3: Säljkanal and Kundtyp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Row 4: Kunds land (single field centered) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div></div> {/* Empty div to maintain grid structure */}
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