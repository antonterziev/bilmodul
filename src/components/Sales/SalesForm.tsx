import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface SalesFormProps {
  vehicleId?: string;
  onBack?: () => void;
  onSuccess?: () => void;
}

export const SalesForm = ({ vehicleId, onBack, onSuccess }: SalesFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Card className="bg-card border rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
        <CardTitle className="text-2xl font-bold">Försäljning</CardTitle>
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
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              Försäljningsformulär kommer att byggas här
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {vehicleId && `Fordon ID: ${vehicleId}`}
            </p>
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
  );
};