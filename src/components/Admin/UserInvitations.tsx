import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  roles: string[]; // Changed to array
  status: string;
  expires_at: string;
  created_at: string;
  invited_by_user_id: string;
}

interface UserInvitationsProps {
  organizationId: string;
}

// Role display mapping
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'admin': 'Admin',
  'lager': 'Lager', 
  'ekonomi': 'Ekonomi',
  'inkop': 'Inköp',
  'pakostnad': 'Påkostnad',
  'forsaljning': 'Försäljning'
};

export const UserInvitations: React.FC<UserInvitationsProps> = ({ organizationId }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  
  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('lager');
  
  const { user } = useAuth();
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
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

  const sendInvitation = async () => {
    if (!email.trim()) {
      toast({
        title: "Fel",
        description: "E-postadress krävs",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invitation', {
        body: {
          email: email.trim(),
          role,
          organizationId
        }
      });

      if (error) throw error;

      toast({
        title: "Inbjudan skickad",
        description: `Inbjudan har skickats till ${email}`,
      });

      setEmail('');
      setRole('lager');
      setShowInviteDialog(false);
      loadInvitations(); // Refresh the list
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skicka inbjudan",
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
          role: invitation.role,
          organizationId
        }
      });

      if (error) throw error;

      toast({
        title: "Inbjudan skickad igen",
        description: `Inbjudan har skickats igen till ${invitationEmail}`,
      });

      loadInvitations(); // Refresh to update timestamp
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte skicka inbjudan igen",
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

  if (loading) {
    return <div className="text-center p-4">Laddar inbjudningar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Användarinbjudningar</h3>
        
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Bjud in användare
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                <Label htmlFor="role">Roll</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lager">Lager</SelectItem>
                    <SelectItem value="ekonomi">Ekonomi</SelectItem>
                    <SelectItem value="inkop">Inköp</SelectItem>
                    <SelectItem value="pakostnad">Påkostnad</SelectItem>
                    <SelectItem value="forsaljning">Försäljning</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={sendInvitation} 
                  disabled={sending}
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
                          Roll: {ROLE_DISPLAY_NAMES[invitation.role] || invitation.role}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInvitation(invitation.id, invitation.email)}
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Skicka igen
                      </Button>
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