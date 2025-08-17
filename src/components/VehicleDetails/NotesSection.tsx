import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit, Save, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface VehicleNote {
  id: string;
  vehicle_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

interface NotesSectionProps {
  vehicleId: string;
  notes: VehicleNote[];
  newNote: string;
  setNewNote: (note: string) => void;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
  editingNoteText: string;
  setEditingNoteText: (text: string) => void;
  notesLoading: boolean;
  formatDate: (dateString: string) => string;
  loadNotes: () => void;
}

export const NotesSection = ({
  vehicleId,
  notes,
  newNote,
  setNewNote,
  editingNoteId,
  setEditingNoteId,
  editingNoteText,
  setEditingNoteText,
  notesLoading,
  formatDate,
  loadNotes
}: NotesSectionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const addNote = async () => {
    if (!newNote.trim() || !user || !vehicleId) return;

    try {
      const { error } = await supabase
        .from('vehicle_notes')
        .insert({
          vehicle_id: vehicleId,
          user_id: user.id,
          note_text: newNote.trim()
        });

      if (error) throw error;

      setNewNote('');
      loadNotes();
      toast({
        title: "Anteckning tillagd",
        description: "Din anteckning har sparats.",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara anteckningen.",
        variant: "destructive",
      });
    }
  };

  const startEditNote = (note: VehicleNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note_text);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !editingNoteText.trim()) return;

    try {
      // Handle vehicle purchase notes differently
      if (editingNoteId.startsWith('vehicle-note-')) {
        // This is the original vehicle purchase note - update the vehicle record
        const { error } = await supabase
          .from('inventory_items')
          .update({ note: editingNoteText.trim() })
          .eq('id', vehicleId);

        if (error) throw error;
      } else {
        // Regular note from vehicle_notes table
        const { error } = await supabase
          .from('vehicle_notes')
          .update({ note_text: editingNoteText.trim() })
          .eq('id', editingNoteId);

        if (error) throw error;
      }

      setEditingNoteId(null);
      setEditingNoteText('');
      loadNotes();
      toast({
        title: "Anteckning uppdaterad",
        description: "Anteckningen har sparats.",
      });
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte uppdatera anteckningen.",
        variant: "destructive",
      });
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna anteckning?')) return;

    try {
      // Handle vehicle purchase notes differently
      if (noteId.startsWith('vehicle-note-')) {
        // This is the original vehicle purchase note - update the vehicle record
        const { error } = await supabase
          .from('inventory_items')
          .update({ note: null })
          .eq('id', vehicleId);

        if (error) throw error;
      } else {
        // Regular note from vehicle_notes table
        const { error } = await supabase
          .from('vehicle_notes')
          .delete()
          .eq('id', noteId);

        if (error) throw error;
      }

      loadNotes();
      toast({
        title: "Anteckning borttagen",
        description: "Anteckningen har tagits bort.",
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort anteckningen.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Anteckningar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new note */}
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Skriv en ny anteckning..."
            rows={3}
          />
          <Button 
            onClick={addNote}
            disabled={!newNote.trim()}
            size="sm"
          >
            Lägg till anteckning
          </Button>
        </div>

        {/* Existing notes */}
        {notesLoading ? (
          <div className="text-center py-4">Laddar anteckningar...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">Inga anteckningar än</div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {editingNoteId === note.id ? (
                      <Textarea
                        value={editingNoteText}
                        onChange={(e) => setEditingNoteText(e.target.value)}
                        rows={3}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {editingNoteId === note.id ? (
                      <>
                        <Button size="sm" variant="outline" onClick={saveEditNote}>
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditNote}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEditNote(note)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteNote(note.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{note.user_name}</span>
                  <span>{formatDate(note.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
