import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Brain, Plus, BookOpen, Flame, Layers, CreditCard, Trash2, LogOut, Zap, History, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth, authedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import type { Deck, ReviewLog } from "@shared/schema";

const DECK_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

interface DeckWithCounts extends Deck {
  totalCards: number;
  dueCount: number;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckColor, setNewDeckColor] = useState(DECK_COLORS[0]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const statsQuery = useQuery<{ totalCards: number; dueToday: number; completedToday: number; streak: number }>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      const res = await authedRequest("GET", "/api/stats");
      return res.json();
    },
  });

  const decksQuery = useQuery<DeckWithCounts[]>({
    queryKey: ["/api/decks"],
    queryFn: async () => {
      const res = await authedRequest("GET", "/api/decks");
      return res.json();
    },
  });

  const historyQuery = useQuery<ReviewLog[]>({
    queryKey: ["/api/study/history"],
    queryFn: async () => {
      const res = await authedRequest("GET", "/api/study/history");
      return res.json();
    },
  });

  const createDeck = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await authedRequest("POST", "/api/decks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      setNewDeckName("");
      setDialogOpen(false);
      toast({ title: "Deck created" });
    },
  });

  const deleteDeck = useMutation({
    mutationFn: async (id: string) => {
      await authedRequest("DELETE", `/api/decks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Deck deleted" });
    },
  });

  const stats = statsQuery.data;
  const decks = decksQuery.data || [];
  const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);

  // Build last 7 days activity heatmap from review history
  const weekActivity = useMemo(() => {
    const logs = historyQuery.data || [];
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const count = logs.filter(l => {
        const t = new Date(l.reviewedAt);
        return t >= d && t < dayEnd;
      }).length;
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      days.push({ label, count });
    }
    return days;
  }, [historyQuery.data]);

  const maxActivity = Math.max(...weekActivity.map(d => d.count), 1);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-5 md:px-8 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Brain className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-sm">Cortex</span>
          </div>
          <div className="flex items-center gap-3">
            {totalDue > 0 && (
              <Link href="/study">
                <Button size="sm" className="text-xs" data-testid="button-start-review">
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Review ({totalDue})
                </Button>
              </Link>
            )}
            <button
              onClick={() => { logout(); setLocation("/"); }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
              data-testid="button-logout"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 md:px-8 py-8">
        {/* Greeting */}
        <h1 className="text-xl font-semibold mb-1" data-testid="text-greeting">
          {user?.displayName ? `Hi, ${user.displayName}` : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {totalDue > 0
            ? `You have ${totalDue} card${totalDue !== 1 ? "s" : ""} due for review today.`
            : "You're all caught up. Create cards or check back later."}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Due today</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-due-today">{stats?.dueToday ?? "—"}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Completed</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-completed">{stats?.completedToday ?? "—"}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Streak</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-streak">
                {stats?.streak ?? 0}
                <span className="text-sm font-normal text-muted-foreground ml-1">day{stats?.streak !== 1 ? "s" : ""}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total cards</span>
              </div>
              <div className="text-2xl font-bold" data-testid="text-total-cards">{stats?.totalCards ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly activity */}
        {(historyQuery.data?.length ?? 0) > 0 && (
          <div className="mb-10 p-4 rounded-xl border border-border/50 bg-card/30">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Last 7 days</span>
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {weekActivity.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-primary/20 transition-all relative"
                    style={{
                      height: `${Math.max(4, (day.count / maxActivity) * 100)}%`,
                      backgroundColor: day.count > 0 ? undefined : undefined,
                    }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-sm bg-primary transition-all"
                      style={{ height: day.count > 0 ? '100%' : '0%' }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{day.label}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-muted-foreground mt-2 text-right">
              {historyQuery.data?.length} reviews total
            </div>
          </div>
        )}

        {/* Decks */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Your decks</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-xs" data-testid="button-new-deck">
                <Plus className="w-3.5 h-3.5 mr-1" />
                New deck
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new deck</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newDeckName.trim()) {
                    createDeck.mutate({ name: newDeckName.trim(), color: newDeckColor });
                  }
                }}
                className="space-y-4 mt-2"
              >
                <div>
                  <Label className="text-sm">Deck name</Label>
                  <Input
                    placeholder="e.g., Biology 101"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="mt-1.5"
                    data-testid="input-deck-name"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm">Color</Label>
                  <div className="flex gap-2 mt-2">
                    {DECK_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewDeckColor(c)}
                        className={`w-7 h-7 rounded-full transition-all ${newDeckColor === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                        style={{ backgroundColor: c }}
                        data-testid={`color-${c}`}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createDeck.isPending} data-testid="button-create-deck">
                  Create deck
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {decksQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map(i => (
              <div key={i} className="h-20 rounded-xl border border-border/50 bg-card/30 animate-pulse" />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60 bg-transparent">
            <CardContent className="p-8 text-center">
              <Layers className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No decks yet. Create your first deck to start adding cards.</p>
              <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)} data-testid="button-create-first-deck">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create your first deck
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {decks.map((deck) => (
              <Link key={deck.id} href={`/deck/${deck.id}`}>
                <Card className="group border-border/50 hover:border-primary/30 transition-colors cursor-pointer" data-testid={`card-deck-${deck.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: deck.color || "#6366f1" }} />
                        <div>
                          <h3 className="font-medium text-sm">{deck.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {deck.totalCards} card{deck.totalCards !== 1 ? "s" : ""}
                            {deck.dueCount > 0 && (
                              <span className="text-primary font-medium ml-2">
                                {deck.dueCount} due
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (confirm("Delete this deck and all its cards?")) {
                            deleteDeck.mutate(deck.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                        data-testid={`button-delete-deck-${deck.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-5 md:px-8 py-6 mt-auto">
        <PerplexityAttribution />
      </footer>
    </div>
  );
}
