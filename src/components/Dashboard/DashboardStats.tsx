import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatsProps {
  totalStock: number;
  inventoryValue: number;
  lastSale: string;
}

export const DashboardStats = ({ totalStock, inventoryValue, lastSale }: DashboardStatsProps) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Totalt lager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalStock}</div>
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
            Senaste försäljning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lastSale}</div>
        </CardContent>
      </Card>
    </div>
  );
};