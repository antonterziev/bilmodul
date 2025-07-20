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
  grossMargin: number;
}
export const Statistics = ({
  onBack,
  totalStock,
  averageStorageDays,
  inventoryValue,
  grossProfit,
  grossMargin
}: StatisticsProps) => {
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState<Date>(new Date(currentYear, 0, 1)); // January 1st of current year
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const handleClear = () => {
    setStartDate(new Date(currentYear, 0, 1));
    setEndDate(undefined);
  };
  return <div className="space-y-6">
      {/* Date Range Selector */}
      

      
      {/* Dashboard Stats */}
      <DashboardStats totalStock={totalStock} averageStorageDays={averageStorageDays} inventoryValue={inventoryValue} grossProfit={grossProfit} grossMargin={grossMargin} />

      
    </div>;
};