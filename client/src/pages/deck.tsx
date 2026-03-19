import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, BookOpen, Upload, Pencil, Check, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { authedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Card as CardType, Deck } from "@shared/schema";

export default function DeckPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id || "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");
  const [importText, setImportText] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ front: string; back: string }[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");

  const cardsQuery = useQuery<CardType[]>({
    queryKey: ["/api/cards", deckId],
    queryFn: async () => {
      const res = await authedRequest("GET", `/api/cards?deckId=${deckId}`);
      return res.json();
    },
  });

  const decksQuery = useQuery<(Deck & { totalCards: number; dueCount: number })[]>({
    queryKey: ["/api/decks"],
    queryFn: async () => {
      const res = await authedRequest("GET", "/api/decks");
      return res.json();
    },
  });

  const deckStatsQuery = useQuery<{
    totalCards: number; dueCount: number; newCount: number;
    learningCount: number; matureCount: number; avgEase: number;
  }>({
    queryKey: ["/api/decks", deckId, "stats"],
    queryFn: async () => {
      const res = await authedRequest("GET", `/api/decks/${deckId}/stats`);
      return res.json();
    },
  });

  const deck = decksQuery.data?.find(d => d.id === deckId);

  const createCard = useMutation({
    mutationFn: async (data: { front: string; back: string; tags?: string }) => {
      const res = await authedRequest("POST", "/api/cards", { ...data, deckId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", deckId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks", deckId, "stats"] });
      setFront("");
      setBack("");
      setTags("");
    },
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, front, back }: { id: string; front: string; back: string }) => {
      const res = await authedRequest("PATCH", `/api/cards/${id}`, { front, back });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", deckId] });
      setEditingCardId(null);
      toast({ title: "Card updated" });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      await authedRequest("DELETE", `/api/cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards", deckId] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks", deckId, "stats"] });
    },
  });

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    createCard.mutate({ front: front.trim(), back: back.trim(), tags: tags.trim() || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (front.trim() && back.trim()) {
        createCard.mutate({ front: front.trim(), back: back.trim(), tags: tags.trim() || undefined });
      }
    }
  };

  const startEditing = (card: CardType) => {
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const saveEdit = () => {
    if (!editingCardId || !editFront.trim() || !editBack.trim()) return;
    updateCard.mutate({ id: editingCardId, front: editFront.trim(), back: editBack.trim() });
  };

  const cancelEdit = () => {
    setEditingCardId(null);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    try {
      const res = await authedRequest("POST", "/api/import/text", { text: importText, deckId });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      if (data.suggestions.length === 0) {
        toast({ title: "No cards found", description: "Try using Q: A: format or Term - Definition format." });
      }
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
  };

  const addSuggestion = (s: { front: string; back: string }) => {
    createCard.mutate({ front: s.front, back: s.back });
    setSuggestions(prev => prev.filter(x => x !== s));
  };

  const addAllSuggestions = () => {
    suggestions.forEach(s => {
      createCard.mutate({ front: s.front, back: s.back });
    });
    setSuggestions([]);
    setImportOpen(false);
    setImportText("");
    toast({ title: `${suggestions.length} cards added` });
  };

  const cards = cardsQuery.data || [];
  const now = new Date();
  const dueCards = cards.filter(c => new Date(c.nextReview) <= now);
  const stats = deckStatsQuery.data;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-5 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="flex items-center gap-2">
              {deck?.color && <div className="w-2.5 h-6 rounded-full" style={{ backgroundColor: deck.color }} />}
              <span className="font-semibold text-sm">{deck?.name || "Deck"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dueCards.length > 0 && (
              <Link href={`/study?deckId=${deckId}`}>
                <Button size="sm" className="text-xs" data-testid="button-study-deck">
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  Study ({dueCards.length})
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        {/* Deck stats bar */}
        {stats && stats.totalCards > 0 && (
          <div className="mb-8 p-4 rounded-xl border border-border/50 bg-card/30">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Deck overview</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <div className="text-lg font-bold text-blue-500" data-testid="text-new-count">{stats.newCount}</div>
                <div className="text-[10px] text-muted-foreground">New</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-500" data-testid="text-learning-count">{stats.learningCount}</div>
                <div className="text-[10px] text-muted-foreground">Learning</div>
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-500" data-testid="text-mature-count">{stats.matureCount}</div>
                <div className="text-[10px] text-muted-foreground">Mature</div>
              </div>
              <div>
                <div className="text-lg font-bold text-primary" data-testid="text-due-count">{stats.dueCount}</div>
                <div className="text-[10px] text-muted-foreground">Due now</div>
              </div>
            </div>
            {stats.totalCards > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${(stats.newCount / stats.totalCards) * 100}%` }} />
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${(stats.learningCount / stats.totalCards) * 100}%` }} />
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(stats.matureCount / stats.totalCards) * 100}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{stats.totalCards} total</span>
              </div>
            )}
          </div>
        )}

        {/* Quick add */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Add cards</h2>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-xs" data-testid="button-import">
                  <Upload className="w-3.5 h-3.5 mr-1" />
                  Import from text
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import cards from text</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground">
                  Paste your notes. Use formats like "Q: question A: answer", "Term - Definition", or "Question? Answer".
                </p>
                <Textarea
                  placeholder="Paste your notes here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  className="mt-2"
                  data-testid="textarea-import"
                />
                <Button onClick={handleImport} className="w-full mt-2" data-testid="button-parse-import">
                  Parse cards
                </Button>
                {suggestions.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{suggestions.length} cards found</span>
                      <Button size="sm" variant="outline" className="text-xs" onClick={addAllSuggestions} data-testid="button-add-all">
                        Add all
                      </Button>
                    </div>
                    {suggestions.map((s, i) => (
                      <div key={i} className="p-3 border rounded-lg text-xs">
                        <div className="font-medium mb-1">Q: {s.front}</div>
                        <div className="text-muted-foreground">A: {s.back}</div>
                        <Button size="sm" variant="ghost" className="text-xs mt-1 h-6 px-2" onClick={() => addSuggestion(s)}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <form onSubmit={handleAddCard} onKeyDown={handleKeyDown} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Front (question)</Label>
                <Textarea
                  placeholder="What is...?"
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm"
                  data-testid="input-front"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Back (answer)</Label>
                <Textarea
                  placeholder="The answer is..."
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm"
                  data-testid="input-back"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Tags (optional, comma-separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="text-sm flex-1"
                data-testid="input-tags"
              />
              <Button type="submit" size="sm" disabled={createCard.isPending} data-testid="button-add-card">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Tip: Press Ctrl+Enter to save quickly.</p>
          </form>
        </div>

        {/* Card list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Cards ({cards.length})</h2>
        </div>

        {cardsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-lg border border-border/50 bg-card/30 animate-pulse" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No cards yet. Add your first card above.
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => {
              const isDue = new Date(card.nextReview) <= now;
              const isEditing = editingCardId === card.id;
              
              return (
                <div key={card.id} className="group flex items-start justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-colors" data-testid={`card-item-${card.id}`}>
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editFront}
                        onChange={(e) => setEditFront(e.target.value)}
                        className="text-sm"
                        placeholder="Front (question)"
                        data-testid="input-edit-front"
                        autoFocus
                      />
                      <Input
                        value={editBack}
                        onChange={(e) => setEditBack(e.target.value)}
                        className="text-sm"
                        placeholder="Back (answer)"
                        data-testid="input-edit-back"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveEdit} disabled={updateCard.isPending} data-testid="button-save-edit">
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} data-testid="button-cancel-edit">
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{card.front}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{card.back}</div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {isDue && (
                            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Due</span>
                          )}
                          {card.tags && (
                            <span className="text-[10px] text-muted-foreground">{card.tags}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground/50">
                            {card.repetitions > 0 ? `${card.interval}d interval · EF ${(card.easeFactor / 100).toFixed(2)}` : "New"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <button
                          onClick={() => startEditing(card)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1"
                          data-testid={`button-edit-card-${card.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this card?")) deleteCard.mutate(card.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                          data-testid={`button-delete-card-${card.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
