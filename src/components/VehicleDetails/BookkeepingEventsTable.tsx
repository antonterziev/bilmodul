import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface BookkeepingEvent {
  id: string;
  type: 'inköp' | 'påkostnad' | 'försäljning';
  description: string;
  responsible: string;
  amount: number;
  status: 'ej_bokförd' | 'bokförd';
  date: string;
  vehicleRegNumber?: string;
  fortnoxVerificationNumber?: string;
  vatType?: string;
}

interface BookkeepingEventsTableProps {
  vehicleId: string;
}

export const BookkeepingEventsTable = ({ vehicleId }: BookkeepingEventsTableProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = useState<BookkeepingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingEventId, setSyncingEventId] = useState<string | null>(null);

  const loadEvents = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load vehicle purchase data
      const { data: vehicle, error: vehicleError } = await supabase
        .from('inventory_items')
        .select(`
          id,
          registration_number,
          purchase_price,
          purchase_date,
          selling_price,
          selling_date,
          status,
          fortnox_sync_status,
          fortnox_verification_number,
          vat_type,
          user_id
        `)
        .eq('id', vehicleId)
        .single();

      if (vehicleError) throw vehicleError;

      // Load user profile for the vehicle
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', vehicle.user_id)
        .single();


      // Load påkostnader
      const { data: pakostnader, error: pakostnadError } = await supabase
        .from('pakostnader')
        .select(`
          id,
          amount,
          supplier,
          category,
          date,
          is_synced,
          fortnox_invoice_number,
          inventory_items!inner(registration_number)
        `)
        .eq('inventory_item_id', vehicleId);

      if (pakostnadError) throw pakostnadError;

      const eventsList: BookkeepingEvent[] = [];

      // Add purchase event
      if (vehicle) {
        eventsList.push({
          id: `purchase-${vehicle.id}`,
          type: 'inköp',
          description: `Inköp ${vehicle.registration_number}`,
          responsible: userProfile?.full_name || 'Okänd',
          amount: vehicle.purchase_price,
          status: vehicle.fortnox_sync_status === 'synced' ? 'bokförd' : 'ej_bokförd',
          date: vehicle.purchase_date,
          vehicleRegNumber: vehicle.registration_number,
          fortnoxVerificationNumber: vehicle.fortnox_verification_number,
          vatType: vehicle.vat_type
        });

        // Add sale event if sold
        if (vehicle.status === 'såld' && vehicle.selling_price && vehicle.selling_date) {
          eventsList.push({
            id: `sale-${vehicle.id}`,
            type: 'försäljning',
            description: `Försäljning ${vehicle.registration_number}`,
            responsible: userProfile?.full_name || 'Okänd',
            amount: vehicle.selling_price,
            status: 'ej_bokförd', // Assuming sales are not automatically synced
            date: vehicle.selling_date,
            vehicleRegNumber: vehicle.registration_number
          });
        }
      }

      // Add påkostnad events
      if (pakostnader) {
        pakostnader.forEach((pakostnad) => {
          eventsList.push({
            id: `pakostnad-${pakostnad.id}`,
            type: 'påkostnad',
            description: `${pakostnad.category} - ${pakostnad.supplier}`,
            responsible: 'System', // Could be improved to track actual user
            amount: pakostnad.amount,
            status: pakostnad.is_synced ? 'bokförd' : 'ej_bokförd',
            date: pakostnad.date,
            vehicleRegNumber: pakostnad.inventory_items?.registration_number,
            fortnoxVerificationNumber: pakostnad.fortnox_invoice_number
          });
        });
      }

      // Sort by date (newest first)
      eventsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(eventsList);

    } catch (error) {
      console.error('Error loading bookkeeping events:', error);
      toast({
        title: 'Fel',
        description: 'Kunde inte ladda bokföringshändelser',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (event: BookkeepingEvent) => {
    if (!user || event.status === 'bokförd') return;

    setSyncingEventId(event.id);
    try {
      let functionName = '';
      let payload = {};

      if (event.type === 'inköp') {
        // Determine function based on VAT type
        switch (event.vatType) {
          case 'VMB':
            functionName = 'fortnox-fsg-vmb';
            break;
          case 'VMBI':
            functionName = 'fortnox-vmbi-inkop';
            break;
          case 'MOMS':
            functionName = 'fortnox-moms-inkop';
            break;
          case 'MOMSI':
            functionName = 'fortnox-momsi-inkop';
            break;
          default:
            throw new Error('Okänd momstyp för synkronisering');
        }
        
        payload = {
          inventoryItemId: vehicleId,
          syncingUserId: user.id
        };
      } else if (event.type === 'påkostnad') {
        functionName = 'fortnox-pakostnad';
        const pakostnadId = event.id.replace('pakostnad-', '');
        payload = {
          pakostnadId,
          syncingUserId: user.id
        };
      } else {
        toast({
          title: 'Information',
          description: 'Försäljningar synkroniseras inte automatiskt ännu',
          variant: 'default'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      if (error) throw error;

      toast({
        title: 'Framgång',
        description: `${event.type === 'inköp' ? 'Inköp' : 'Påkostnad'} synkroniserat med Fortnox`,
      });

      // Reload events to update status
      await loadEvents();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: 'Fel',
        description: error.message || 'Synkronisering misslyckades',
        variant: 'destructive'
      });
    } finally {
      setSyncingEventId(null);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'inköp':
        return 'bg-blue-100 text-blue-800';
      case 'påkostnad':
        return 'bg-orange-100 text-orange-800';
      case 'försäljning':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'bokförd' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-yellow-100 text-yellow-800';
  };

  useEffect(() => {
    loadEvents();
  }, [vehicleId, user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bokföringshändelser</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bokföringshändelser</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadEvents}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Uppdatera
        </Button>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Inga bokföringshändelser funna
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Ansvarig</TableHead>
                <TableHead className="text-right">Belopp (inkl moms)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-center">Synk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge 
                        variant="secondary" 
                        className={getEventTypeColor(event.type)}
                      >
                        {event.type}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {event.description}
                      </div>
                      {event.fortnoxVerificationNumber && (
                        <div className="text-xs text-muted-foreground">
                          Verifikation: {event.fortnoxVerificationNumber}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{event.responsible}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAmount(event.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary"
                      className={getStatusColor(event.status)}
                    >
                      {event.status === 'bokförd' ? 'Bokförd' : 'Ej bokförd'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(event.date), 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell className="text-center">
                    {event.status === 'ej_bokförd' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(event)}
                        disabled={syncingEventId === event.id || event.type === 'försäljning'}
                      >
                        {syncingEventId === event.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Synka'
                        )}
                      </Button>
                    ) : (
                      <span className="text-green-600 text-sm">Synkad</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};