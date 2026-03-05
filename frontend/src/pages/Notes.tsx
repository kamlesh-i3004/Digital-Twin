import React, { useEffect, useState } from 'react';
import { notesApi } from '@/services/api';
import type { Note } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  Clock,
  Save,
  X,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const NoteEditor: React.FC<{
  note?: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: { title: string; content: string }) => void;
}> = ({ note, isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    } else {
      setTitle('');
      setContent('');
    }
  }, [note, isOpen]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    onSave({ title, content });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{note ? 'Edit Note' : 'New Note'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Input
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold"
          />
          <Textarea
            placeholder="Start writing..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[300px] resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteConfirmDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  noteTitle: string;
}> = ({ isOpen, onClose, onConfirm, noteTitle }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete Note</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <p className="text-muted-foreground">
          Are you sure you want to delete "<span className="font-medium text-foreground">{noteTitle}</span>"?
        </p>
        <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const Notes: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    fetchNotes();
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const data = await notesApi.getAll();
      setNotes(data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    } catch (error) {
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async (noteData: { title: string; content: string }) => {
    try {
      await notesApi.create(noteData);
      toast.success('Note created successfully');
      fetchNotes();
    } catch (error) {
      toast.error('Failed to create note');
    }
  };

  const handleUpdateNote = async (noteData: { title: string; content: string }) => {
    if (!editingNote) return;
    try {
      await notesApi.update(editingNote.id, noteData);
      toast.success('Note updated successfully');
      fetchNotes();
      if (selectedNote?.id === editingNote.id) {
        setSelectedNote({ ...selectedNote, ...noteData, updated_at: new Date().toISOString() });
      }
      setEditingNote(null);
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async () => {
    if (!deletingNote) return;
    try {
      await notesApi.delete(deletingNote.id);
      toast.success('Note deleted successfully');
      fetchNotes();
      if (selectedNote?.id === deletingNote.id) {
        setSelectedNote(null);
      }
      setDeletingNote(null);
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPreview = (content: string, maxLength: number = 100) => {
    const plainText = content.replace(/\n/g, ' ').trim();
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  };

  // Mobile view - show either list or detail
  if (isMobileView && selectedNote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedNote(null)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Note</h1>
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">{selectedNote.title}</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setEditingNote(selectedNote); setIsEditorOpen(true); }}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeletingNote(selectedNote)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last edited {format(new Date(selectedNote.updated_at), 'PPp')}
            </p>
            <div className="whitespace-pre-wrap text-foreground">
              {selectedNote.content}
            </div>
          </CardContent>
        </Card>

        <NoteEditor
          note={editingNote}
          isOpen={isEditorOpen}
          onClose={() => { setIsEditorOpen(false); setEditingNote(null); }}
          onSave={editingNote ? handleUpdateNote : handleCreateNote}
        />

        <DeleteConfirmDialog
          isOpen={!!deletingNote}
          onClose={() => setDeletingNote(null)}
          onConfirm={handleDeleteNote}
          noteTitle={deletingNote?.title || ''}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Capture your thoughts and ideas</p>
        </div>
        <Button onClick={() => { setEditingNote(null); setIsEditorOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes List */}
        <div className={cn('space-y-3', selectedNote && 'lg:col-span-1', !selectedNote && 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3')}>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))
          ) : filteredNotes.length === 0 ? (
            <Card className="col-span-full py-12">
              <CardContent className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">
                  {searchQuery ? 'No notes found' : 'No notes yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : "Start capturing your thoughts and ideas"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => { setEditingNote(null); setIsEditorOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create your first note
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredNotes.map((note) => (
              <Card
                key={note.id}
                className={cn(
                  'cursor-pointer hover:shadow-md transition-all',
                  selectedNote?.id === note.id && 'ring-2 ring-primary'
                )}
                onClick={() => setSelectedNote(note)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate">{note.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {getPreview(note.content)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(note.updated_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote(note);
                            setIsEditorOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingNote(note);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Note Detail (Desktop) */}
        {selectedNote && (
          <div className="hidden lg:block lg:col-span-2">
            <Card className="h-[calc(100vh-200px)]">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{selectedNote.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last edited {format(new Date(selectedNote.updated_at), 'PPp')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingNote(selectedNote); setIsEditorOpen(true); }}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeletingNote(selectedNote)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="whitespace-pre-wrap text-foreground">
                    {selectedNote.content}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Note Editor Dialog */}
      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setEditingNote(null); }}
        onSave={editingNote ? handleUpdateNote : handleCreateNote}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!deletingNote}
        onClose={() => setDeletingNote(null)}
        onConfirm={handleDeleteNote}
        noteTitle={deletingNote?.title || ''}
      />
    </div>
  );
};

export default Notes;
