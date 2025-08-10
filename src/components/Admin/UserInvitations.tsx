import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Clock, CheckCircle, XCircle, RotateCcw, Trash2 } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  permissions: string[]; // Changed from roles to permissions
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_user_id: string;
}

interface UserInvitationsProps {
  organizationId: string;
}

// Available permissions (renamed from roles)
const AVAILABLE_PERMISSIONS = [
  { key: 'admin', label: 'Admin' },
  { key: 'lager', label: 'Lager' },
  { key: 'ekonomi', label: 'Ekonomi' },
  { key: 'inkop', label: 'Inköp' },
  { key: 'pakostnad', label: 'Påkostnad' },
  { key: 'forsaljning', label: 'Försäljning' }
];

export const UserInvitations: React.FC<UserInvitationsProps> = ({ organizationId }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  
  // Form state - now using array for multiple permissions
  const [email, setEmail] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['lager']);
  
  const { user, session } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadInvitations();
  }, [organizationId]);

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .neq('status', 'accepted') // Filter out accepted invitations
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Map the data to include permissions array (which exists in the database)
      const mappedInvitations = (data || []).map((invitation: any) => ({
        ...invitation,
        permissions: invitation.permissions || []
      }));
      setInvitations(mappedInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ladda inbjudningar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionKey: string) => {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionKey)) {
        // Remove permission, but ensure at least one permission is selected
        const newPermissions = prev.filter(p => p !== permissionKey);
        return newPermissions.length > 0 ? newPermissions : prev;
      } else {
        // Add permission
        return [...prev, permissionKey];
      }
    });
  };

  const sendInvitation = async () => {
    if (!email.trim()) {
      toast({
        title: "Fel",
        description: "E-postadress krävs",
        variant: "destructive",
      });
      return;
    }

    if (selectedPermissions.length === 0) {
      toast({
        title: "Fel",
        description: "Minst en behörighet måste väljas",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: email.trim(),
          permissions: selectedPermissions, // Send array of permissions
          organizationId
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) throw error;

      toast({
        title: "Inbjudan skickad",
        description: `Inbjudan har skickats till ${email}`,
      });

      setEmail('');
      setSelectedPermissions(['lager']);
      setShowInviteDialog(false);
      loadInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      const serverMessage = (error as any)?.context?.error || (error as any)?.message || "Kunde inte skicka inbjudan";
      toast({
        title: "Fel",
        description: serverMessage,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const resendInvitation = async (invitationId: string, invitationEmail: string) => {
    try {
      const invitation = invitations.find(inv => inv.id === invitationId);
      if (!invitation) return;

      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          permissions: invitation.permissions, // Send array of permissions
          organizationId
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) throw error;

      toast({
        title: "Inbjudan skickad igen",
        description: `Inbjudan har skickats igen till ${invitationEmail}`,
      });

      loadInvitations(); // Refresh to update timestamp
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      const serverMessage = (error as any)?.context?.error || (error as any)?.message || "Kunde inte skicka inbjudan igen";
      toast({
        title: "Fel",
        description: serverMessage,
        variant: "destructive",
      });
    }
  };

  const removeInvitation = async (invitationId: string, invitationEmail: string) => {
    try {
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Inbjudan borttagen",
        description: `Inbjudan till ${invitationEmail} har tagits bort`,
      });

      loadInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error removing invitation:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte ta bort inbjudan",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'accepted') {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Accepterad</Badge>;
    }
    
    if (status === 'pending' && isExpired) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Utgången</Badge>;
    }
    
    if (status === 'pending') {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Väntar</Badge>;
    }
    
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPermissions = (permissions: string[]) => {
    return permissions.map(permission => {
      const permissionData = AVAILABLE_PERMISSIONS.find(p => p.key === permission);
      return permissionData ? permissionData.label : permission;
    }).join(', ');
  };

  if (loading) {
    return <div className="text-center p-4">Laddar inbjudningar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Inbjudningar</h3>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Bjud in användare
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bjud in ny användare</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">E-postadress</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="användare@exempel.se"
                />
              </div>
              
              <div>
                <Label>Behörigheter</Label>
                 <div className="grid grid-cols-2 gap-3 mt-2 p-3 border rounded-lg">
                   {AVAILABLE_PERMISSIONS.map((permission) => (
                    <div key={permission.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={permission.key}
                        checked={selectedPermissions.includes(permission.key)}
                        onCheckedChange={() => togglePermission(permission.key)}
                      />
                      <Label htmlFor={permission.key} className="text-sm font-normal">
                        {permission.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Välj minst en behörighet
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={sendInvitation} 
                  disabled={sending || selectedPermissions.length === 0}
                  className="flex-1"
                >
                  {sending ? "Skickar..." : "Skicka inbjudan"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowInviteDialog(false)}
                  disabled={sending}
                >
                  Avbryt
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Inga inbjudningar har skickats ännu</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <Card key={invitation.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Behörigheter: {formatPermissions(invitation.permissions)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Skickad: {formatDate(invitation.created_at)}</span>
                      <span>Utgår: {formatDate(invitation.expires_at)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {getStatusBadge(invitation.status, invitation.expires_at)}
                    
                    {invitation.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvitation(invitation.id, invitation.email)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Skicka igen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeInvitation(invitation.id, invitation.email)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Ta bort
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};