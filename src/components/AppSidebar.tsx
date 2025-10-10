
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VehicleSearch } from "@/components/VehicleSearch";
import { 
  Home, 
  BarChart3, 
  Package, 
  CreditCard, 
  Handshake, 
  Zap,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Car,
  Truck,
  FileCheck,
  Receipt,
  Users,
  BookOpen,
  CheckSquare,
  File,
  Landmark,
  
  Link,
  Calculator,
  FileText,
  Shield,
  List
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  expandedSections: Record<string, boolean>;
  onSectionToggle: (section: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchPlaceholder: string;
  hasVehicles: boolean;
  onVehicleSelect: (vehicleId: string) => void;
}

export function AppSidebar({ 
  currentView, 
  onViewChange, 
  expandedSections, 
  onSectionToggle,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  hasVehicles,
  onVehicleSelect
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadUserPermissions();
    }
  }, [user]);

  const loadUserPermissions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('permission')
        .eq('user_id', user.id);

      if (!error && data) {
        setUserPermissions(data.map(p => p.permission));
      }
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  };

  // Check if user has specific permission
  const hasPermission = (permission: string) => userPermissions.includes(permission);

  const isActive = (view: string) => currentView === view;
  
  const getNavClass = (view: string) =>
    isActive(view) 
      ? "bg-black text-white hover:bg-black hover:text-white" 
      : "text-muted-foreground hover:bg-muted/50";

  const handleSectionToggle = (sectionId: string) => {
    // Close all other sections first
    Object.keys(expandedSections).forEach(id => {
      if (id !== sectionId && expandedSections[id]) {
        onSectionToggle(id);
      }
    });
    // Then toggle the clicked section
    onSectionToggle(sectionId);
  };

  const mainMenuItems = [
    { id: "overview", title: "Översikt", icon: Home },
    { id: "registrera_inkop", title: "Registrera inköp", icon: Car, requiresPermission: "lager" },
    { id: "lager_all", title: "Lagerlista", icon: List, requiresPermission: "lager" },
  ];

  const expandableMenuItems = [];

  return (
    <Sidebar className="w-72 bg-white border-r" collapsible="none">
      <SidebarContent className="bg-white">
        {/* Search at top */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="p-4 pb-2 space-y-3">
              <VehicleSearch
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                searchPlaceholder={searchPlaceholder}
                hasVehicles={hasVehicles}
                onVehicleSelect={onVehicleSelect}
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* All Navigation - Combined */}
        <SidebarGroup className="-mt-2">
          <SidebarGroupContent>
            <div className="px-4">
              <SidebarMenu>
                {mainMenuItems
                  .filter((item) => !item.requiresPermission || hasPermission(item.requiresPermission))
                  .map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton 
                      onClick={() => onViewChange(item.id)}
                      className={getNavClass(item.id)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                
                {expandableMenuItems.map((section) => (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      onClick={() => handleSectionToggle(section.id)}
                      className="text-muted-foreground hover:bg-muted/50"
                    >
                      <section.icon className="h-4 w-4" />
                      <span>{section.title}</span>
                      {expandedSections[section.id] ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                    
                     {expandedSections[section.id] && (
                       <SidebarMenu className="ml-6 mt-1 space-y-1">
                          {section.children.map((child) => (
                            <SidebarMenuItem key={child.id} className="pr-6">
                              <SidebarMenuButton
                                onClick={section.id === 'affarer' ? undefined : () => onViewChange(child.id)}
                                className={section.id === 'affarer'
                                  ? "cursor-not-allowed pointer-events-none text-muted-foreground hover:bg-muted/50 flex items-center justify-between" 
                                  : getNavClass(child.id)
                                }
                                size="sm"
                              >
                                <span className="text-sm">{child.title}</span>
                                {section.id === 'affarer' && (
                                  <span className="inline-flex items-center rounded-full bg-yellow-200 px-1.5 py-0 text-[11px] font-medium text-yellow-900">
                                    PRO
                                  </span>
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                       </SidebarMenu>
                     )}
                  </SidebarMenuItem>
                ))}
                
                {/* Integrationer */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("integrationer")}
                    className={getNavClass("integrationer")}
                  >
                    <Link className="h-4 w-4" />
                    <span>Integrationer</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                {/* Settings */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("settings")}
                    className={getNavClass("settings")}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    <span>Inställningar</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
