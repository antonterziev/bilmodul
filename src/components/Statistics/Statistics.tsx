import { useState } from "react";
import { DashboardStats } from "@/components/Dashboard/DashboardStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface StatisticsProps {
  onBack: () => void;
  totalStock: number;
  averageStorageDays: number;
  inventoryValue: number;
  grossProfit: number;
}

export const Statistics = ({ onBack, totalStock, averageStorageDays, inventoryValue, grossProfit }: StatisticsProps) => {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState<Date>(new Date(currentYear, 0, 1)); // January 1st of current year
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const handleClear = () => {
    setStartDate(new Date(currentYear, 0, 1));
    setEndDate(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Från</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "yyyy-MM-dd") : "Välj datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Till</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "yyyy-MM-dd") : "åååå-mm-dd"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button variant="secondary" onClick={handleClear}>
              Rensa
            </Button>
          </div>
        </CardContent>
      </Card>

      
      {/* Dashboard Stats */}
      <DashboardStats 
        totalStock={totalStock}
        averageStorageDays={averageStorageDays}
        inventoryValue={inventoryValue}
        grossProfit={grossProfit}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Statistics Card */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-800 text-white">
            <CardHeader>
              <CardTitle className="text-lg">Statisk över lagerfordon</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-base font-medium mb-4">Bilar</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-300 mb-1">På Lager</div>
                    <div className="bg-slate-700 rounded px-3 py-2">
                      <span className="text-2xl font-bold">67</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Sålda</div>
                    <div className="bg-slate-700 rounded px-3 py-2">
                      <span className="text-2xl font-bold">90</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-300 mb-1">På annons</div>
                    <div className="bg-slate-700 rounded px-3 py-2">
                      <span className="text-2xl font-bold">16</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-300 mb-1">Snitt lagerdagar</div>
                    <div className="bg-slate-700 rounded px-3 py-2">
                      <span className="text-2xl font-bold">123</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Sales Card */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Genomsnittlig daglig försäljning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Total försäljning den här månaden
                  </div>
                  <div className="text-3xl font-bold">270.000</div>
                </div>
                <div className="h-20 bg-gradient-to-r from-green-200 to-green-300 rounded relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 100 40">
                    <path
                      d="M0,30 Q25,20 50,25 T100,15"
                      stroke="#22c55e"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};