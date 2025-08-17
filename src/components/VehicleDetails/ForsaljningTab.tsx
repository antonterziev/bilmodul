import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DollarSign, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface ForsaljningTabProps {
  salesUsers: Array<{ user_id: string; full_name: string; email: string }>;
  selectedSellerId: string;
  setSelectedSellerId: (id: string) => void;
  salesDate: Date | undefined;
  setSalesDate: (date: Date | undefined) => void;
  salesPriceDisplay: string;
  setSalesPriceDisplay: (price: string) => void;
}

export const ForsaljningTab = ({
  salesUsers,
  selectedSellerId,
  setSelectedSellerId,
  salesDate,
  setSalesDate,
  salesPriceDisplay,
  setSalesPriceDisplay
}: ForsaljningTabProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Försäljningsinformation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="seller">Säljare</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj säljare" />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Försäljningsdatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {salesDate ? format(salesDate, "PPP") : <span>Välj datum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={salesDate}
                    onSelect={setSalesDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="salesPrice">Försäljningspris (SEK)</Label>
              <Input
                id="salesPrice"
                type="number"
                value={salesPriceDisplay}
                onChange={(e) => setSalesPriceDisplay(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <Button className="w-full" disabled>
            <DollarSign className="w-4 h-4 mr-2" />
            Markera som såld
          </Button>
          
          <p className="text-sm text-muted-foreground text-center">
            Försäljningsfunktionen kommer snart
          </p>
        </CardContent>
      </Card>
    </div>
  );
};