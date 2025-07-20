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
  Landmark
} from "lucide-react";

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
      ? "bg-primary text-primary-foreground" 
      : "text-muted-foreground hover:bg-muted/50";

  const mainMenuItems = [
    { id: "overview", title: "Översikt", icon: Home },
    { id: "statistics", title: "Statistik", icon: BarChart3 },
  ];

  const expandableMenuItems = [
    {
      id: "lager",
      title: "Lager",
      icon: Package,
      children: [
        { id: "lager_all", title: "Alla fordon", icon: Car },
        { id: "lager_stock", title: "På lager", icon: Package },
        { id: "lager_sold", title: "Sålda", icon: CheckSquare },
      ]
    },
    {
      id: "inkop",
      title: "Inköp",
      icon: Car,
      children: [
        { id: "purchase_form", title: "Registrera inköp", icon: FileCheck },
        { id: "logistics", title: "Logistik", icon: Truck },
      ]
    },
    {
      id: "finansiering",
      title: "Finansiering",
      icon: CreditCard,
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
    <Sidebar className="w-72">
      <SidebarContent>
        {/* Main Navigation - No group labels */}
        <SidebarGroup>
          <SidebarGroupContent>
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Expandable Sections - No group labels */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {expandableMenuItems.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    onClick={() => onSectionToggle(section.id)}
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
                    <SidebarMenu className="ml-4 mt-1">
                      {section.children.map((child) => (
                        <SidebarMenuItem key={child.id}>
                          <SidebarMenuButton
                            onClick={() => onViewChange(child.id)}
                            className={getNavClass(child.id)}
                            size="sm"
                          >
                            <child.icon className="h-3 w-3" />
                            <span className="text-sm">{child.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}