import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatsProps {
  totalStock: number;
  averageStorageDays: number;
  inventoryValue: number;
  grossProfit: number;
}

export const DashboardStats = ({ totalStock, averageStorageDays, inventoryValue, grossProfit }: DashboardStatsProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Fordon i lager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStock} st</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lagerdagar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageStorageDays} dagar</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lagervärde
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPrice(inventoryValue)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Bruttovinst
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${grossProfit < 0 ? 'text-red-600' : grossProfit > 0 ? 'text-green-600' : ''}`}>
            {formatPrice(grossProfit)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};