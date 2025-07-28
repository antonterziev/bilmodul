import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Building, Plus, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface UserWithProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  organization_id: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  created_at: string;
  user_count: number;
  users: UserWithProfile[];
}

export const UserManagement = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: roleData } = await supabase.rpc('get_current_user_role');
      setUserRole(roleData);
    } catch (error) {
      console.error('Error checking user role:', error);
    }
  };

  const getDisplayName = (user: UserWithProfile) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    
    // Extract name from email if database fields are empty
    const emailPart = user.email.split('@')[0];
    const nameParts = emailPart.split('.');
    
    if (nameParts.length >= 2) {
      const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
      const lastName = nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1);
      return `${firstName} ${lastName}`;
    }
    
    return user.email;
  };

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      // Get organizations with user count
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          profiles(count)
        `)
        .order('name');

      if (orgError) throw orgError;

      // Get all profiles with their roles and organizations
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          organization_id,
          organizations!inner(id, name)
        `);

      if (profilesError) throw profilesError;

      // Get user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Group users by organization
      const formattedOrgs: Organization[] = orgData?.map((org: any) => {
        const orgUsers = profilesData
          ?.filter((profile: any) => profile.organization_id === org.id)
          .map((profile: any) => {
            const userRole = rolesData?.find(role => role.user_id === profile.user_id);
            return {
              user_id: profile.user_id,
              email: profile.email,
              first_name: profile.first_name || '',
              last_name: profile.last_name || '',
              organization_name: profile.organizations.name,
              organization_id: profile.organization_id,
              role: userRole?.role || 'bilhandel'
            };
          }) || [];

        return {
          id: org.id,
          name: org.name,
          created_at: org.created_at,
          user_count: orgUsers.length,
          users: orgUsers
        };
      }) || [];

      setOrganizations(formattedOrgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda organisationer och användare",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const updateUserRole = async (userId: string, newRole: "administrator" | "bilhandel" | "ekonomi" | "superuser") => {
    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      // Update the user in the organizations state
      setOrganizations(organizations.map(org => ({
        ...org,
        users: org.users.map(user => 
          user.user_id === userId ? { ...user, role: newRole } : user
        )
      })));

      toast({
        title: "Uppdaterat",
        description: "Användarens roll har uppdaterats"
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera användarens roll",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const updateUserOrganization = async (userId: string, newOrgId: string) => {
    setUpdating(userId);
    try {
      // Update profile organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: newOrgId })
        .eq('user_id', userId);

      if (profileError) throw profileError;

      // Update user role organization
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ organization_id: newOrgId })
        .eq('user_id', userId);

      if (roleError) throw roleError;

      // Refresh organizations list
      await loadOrganizations();

      toast({
        title: "Uppdaterat",
        description: "Användarens organisation har uppdaterats"
      });
    } catch (error) {
      console.error('Error updating user organization:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera användarens organisation",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) return;
    
    setCreatingOrg(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim() });

      if (error) throw error;

      await loadOrganizations();
      setNewOrgName("");
      
      toast({
        title: "Skapat",
        description: "Ny organisation har skapats"
      });
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa organisation",
        variant: "destructive"
      });
    } finally {
      setCreatingOrg(false);
    }
  };

  const toggleOrganization = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'superuser': return 'destructive';
      case 'administrator': return 'destructive';
      case 'ekonomi': return 'secondary';
      case 'bilhandel': return 'default';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Laddar organisationer och användare...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Organisationer och Användare</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadOrganizations}
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      <div className="space-y-4">
        {organizations.map((org) => (
          <Card key={org.id}>
            <Collapsible 
              open={expandedOrgs.has(org.id)} 
              onOpenChange={() => toggleOrganization(org.id)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedOrgs.has(org.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Building className="w-5 h-5" />
                      <div>
                        <CardTitle className="text-left">{org.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {org.user_count} användare • Skapad {new Date(org.created_at).toLocaleDateString('sv-SE')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  {org.users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Användare</TableHead>
                          <TableHead>E-post</TableHead>
                          <TableHead>Roll</TableHead>
                          <TableHead>Organisation</TableHead>
                          <TableHead>Hantering</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {org.users.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>
                              <div className="font-medium">
                                {getDisplayName(user)}
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(user.role)}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>{user.organization_name}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Select
                                  value={user.role}
                                  onValueChange={(value) => updateUserRole(user.user_id, value as "administrator" | "bilhandel" | "ekonomi" | "superuser")}
                                  disabled={updating === user.user_id}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="superuser">Superuser</SelectItem>
                                    <SelectItem value="administrator">Administration</SelectItem>
                                    <SelectItem value="ekonomi">Ekonomi</SelectItem>
                                    <SelectItem value="bilhandel">Bilhandel</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select
                                  value={user.organization_id}
                                  onValueChange={(value) => updateUserOrganization(user.user_id, value)}
                                  disabled={updating === user.user_id}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {organizations.map((orgOption) => (
                                      <SelectItem key={orgOption.id} value={orgOption.id}>
                                        {orgOption.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {updating === user.user_id && (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Inga användare i denna organisation
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {userRole === 'superuser' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Organisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor="orgName" className="text-sm font-medium">
                  Skapa ny organisation
                </label>
                <Input
                  id="orgName"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Organisationsnamn"
                  disabled={creatingOrg}
                />
              </div>
              <Button 
                onClick={createOrganization}
                disabled={!newOrgName.trim() || creatingOrg}
              >
                {creatingOrg ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Skapa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};