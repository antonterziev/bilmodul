
import { useLocation } from "react-router-dom";
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
  Search
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}

export function AppSidebar({ 
  currentView, 
  onViewChange, 
  expandedSections, 
  onSectionToggle 
}: AppSidebarProps) {
  const location = useLocation();

  const isActive = (view: string) => currentView === view;
  
  const getNavClass = (view: string) =>
    isActive(view) 
      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" 
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
  ];

  const expandableMenuItems = [
    {
      id: "lager",
      title: "Lager",
      icon: Car,
      children: [
        { id: "lager_all", title: "Alla fordon", icon: Car },
        { id: "lager_stock", title: "I lager", icon: Package },
        { id: "lager_sold", title: "Sålda", icon: CheckSquare },
        { id: "logistics", title: "Logistik", icon: Truck },
      ]
    },
    {
      id: "finansiering",
      title: "Finansiering",
      icon: Landmark,
      children: [
        { id: "lagerfinansiering", title: "Lagerfinansiering", icon: Landmark },
        { id: "slutkundsfinansiering", title: "Slutkundsfinansiering", icon: Users },
      ]
    },
    {
      id: "affarer",
      title: "Affärer",
      icon: Handshake,
      children: [
        { id: "sales", title: "Försäljning", icon: Receipt },
        { id: "avtal", title: "Avtal", icon: FileCheck },
        { id: "dokument", title: "Dokument", icon: File },
        { id: "fakturor", title: "Fakturor", icon: Receipt },
      ]
    },
    {
      id: "direktfloden",
      title: "Direktflöden",
      icon: Zap,
      children: [
        { id: "direktbetalningar", title: "Direktbetalningar", icon: CreditCard },
        { id: "kundregister", title: "Kundregister", icon: Users },
        { id: "bokforingsunderlag", title: "Bokföringsunderlag", icon: BookOpen },
        { id: "verifikation", title: "Verifikation", icon: CheckSquare },
      ]
    }
  ];

  return (
    <Sidebar className="w-72 bg-white border-r" collapsible="none">
      <SidebarContent className="bg-white">
        {/* Registrera inköp and Search at top */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="p-4 pb-2 space-y-3">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white border-blue-600 font-medium w-full"
                onClick={() => onViewChange("purchase_form")}
              >
                Registrera fordon
              </Button>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Sök fordon..."
                  className="pl-9 w-full"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* All Navigation - Combined */}
        <SidebarGroup className="-mt-2">
          <SidebarGroupContent>
            <div className="px-4">
              <SidebarMenu>
                {mainMenuItems.map((item) => (
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
                                onClick={['finansiering', 'affarer', 'direktfloden'].includes(section.id) ? undefined : () => onViewChange(child.id)}
                                className={['finansiering', 'affarer', 'direktfloden'].includes(section.id)
                                  ? "cursor-not-allowed pointer-events-none text-muted-foreground hover:bg-muted/50 flex items-center justify-between" 
                                  : getNavClass(child.id)
                                }
                                size="sm"
                              >
                                <span className="text-sm">{child.title}</span>
                                {['finansiering', 'affarer', 'direktfloden'].includes(section.id) && (
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
