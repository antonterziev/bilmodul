import { useState, useEffect, useRef } from "react";
import { Search, Car } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Vehicle {
  id: string;
  registration_number: string;
  brand: string;
  model: string | null;
  status: string;
  purchase_date: string;
}

interface VehicleSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchPlaceholder: string;
  hasVehicles: boolean;
  onVehicleSelect: (vehicleId: string) => void;
}

export function VehicleSearch({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  hasVehicles,
  onVehicleSelect
}: VehicleSearchProps) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load vehicles initially and set up real-time updates
  useEffect(() => {
    if (user) {
      loadVehicles();
      setupRealtimeUpdates();
    }
  }, [user]);

  // Filter vehicles when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredVehicles([]);
      setShowDropdown(false);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = vehicles.filter(vehicle => {
      const registrationMatch = vehicle.registration_number.toLowerCase().includes(searchLower);
      const brandMatch = vehicle.brand.toLowerCase().includes(searchLower);
      const modelMatch = vehicle.model?.toLowerCase().includes(searchLower) || false;
      
      return registrationMatch || brandMatch || modelMatch;
    });

    setFilteredVehicles(filtered);
    setShowDropdown(filtered.length > 0 && searchTerm.trim().length > 0);
  }, [searchTerm, vehicles]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadVehicles = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, registration_number, brand, model, status, purchase_date')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealtimeUpdates = () => {
    const channel = supabase
      .channel('vehicle-search-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'inventory_items'
        },
        (payload) => {
          console.log('Real-time vehicle update:', payload);
          loadVehicles(); // Reload vehicles when any change occurs
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSearchChange(value);
    
    if (value.trim().length > 0) {
      setShowDropdown(true);
    }
  };

  const handleVehicleClick = (vehicleId: string) => {
    setShowDropdown(false);
    onSearchChange(""); // Clear search term
    onVehicleSelect(vehicleId);
  };

  const handleInputFocus = () => {
    if (searchTerm.trim().length > 0 && filteredVehicles.length > 0) {
      setShowDropdown(true);
    }
  };

  const getVehicleDisplayText = (vehicle: Vehicle) => {
    return `${vehicle.registration_number} - ${vehicle.brand}${vehicle.model ? ` ${vehicle.model}` : ''}`;
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'på_lager': { text: 'På lager', color: 'bg-green-100 text-green-800' },
      'såld': { text: 'Såld', color: 'bg-gray-100 text-gray-800' }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { text: status, color: 'bg-blue-100 text-blue-800' };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={hasVehicles ? searchPlaceholder : "Lägg till fordon först..."}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          disabled={!hasVehicles}
          className="pl-9 w-full disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${hasVehicles ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && filteredVehicles.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto shadow-lg border">
          <div className="p-2">
            {filteredVehicles.slice(0, 8).map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => handleVehicleClick(vehicle.id)}
                className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer rounded-md transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <Car className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {getVehicleDisplayText(vehicle)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inköpt: {new Date(vehicle.purchase_date).toLocaleDateString('sv-SE')}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(vehicle.status)}
                </div>
              </div>
            ))}
            
            {filteredVehicles.length > 8 && (
              <div className="text-center p-2 text-sm text-muted-foreground border-t">
                +{filteredVehicles.length - 8} fler resultat...
              </div>
            )}
            
            {filteredVehicles.length === 0 && searchTerm.trim() && (
              <div className="text-center p-4 text-sm text-muted-foreground">
                Inga fordon hittades för "{searchTerm}"
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}