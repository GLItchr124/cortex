import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, RotateCcw, CheckCircle2, Zap, Brain, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { authedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Card as CardType } from "@shared/schema";

const RATING_OPTIONS = [
  { value: 1, label: "Again", description: "Didn't know it", color: "text-red-500 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900", key: "1" },
  { value: 2, label: "Hard", description: "Partially recalled", color: "text-orange-500 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900", key: "2" },
  { value: 3, label: "Good", description: "Recalled with effort", color: "text-emerald-500 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900", key: "3" },
  { value: 4, label: "Easy", description: "Instantly recalled", color: "text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900", key: "4" },
];

export default function StudyPage() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const deckId = params.get("deckId") || undefined;

  // The queue is a working list: answered cards are removed; "Again" cards go to the back
  const [queue, setQueue] = useState<CardType[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [totalToReview, setTotalToReview] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const dueQuery = useQuery<CardType[]>({
    queryKey: ["/api/study/due", deckId || "all"],
    queryFn: async () => {
      const url = deckId ? `/api/study/due?deckId=${deckId}` : "/api/study/due";
      const res = await authedRequest("GET", url);
      return res.json();
    },
  });

  // Initialize queue once from fetched due cards
  useEffect(() => {
    if (dueQuery.data && !initialized) {
      // Shuffle for variety
      const shuffled = [...dueQuery.data].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setTotalToReview(shuffled.length);
      setInitialized(true);
    }
  }, [dueQuery.data, initialized]);

  const reviewMutation = useMutation({
    mutationFn: async ({ cardId, rating }: { cardId: string; rating: number }) => {
      const res = await authedRequest("POST", "/api/study/review", { cardId, rating });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/study/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decks"] });
    },
  });

  const currentCard = queue[0];
  const progress = totalToReview > 0 ? (completed / totalToReview) * 100 : 0;

  const handleRate = useCallback((rating: number) => {
    if (!currentCard || animatingOut) return;
    
    // Submit review to backend
    reviewMutation.mutate({ cardId: currentCard.id, rating });
    
    // Animate card out
    setAnimatingOut(true);
    
    setTimeout(() => {
      setQueue(prev => {
        const rest = prev.slice(1);
        if (rating === 1) {
          // "Again" — put this card at the back of the queue for another attempt
          return [...rest, currentCard];
        }
        return rest;
      });
      
      setCompleted(prev => prev + 1);
      setRevealed(false);
      setAnimatingOut(false);
      
      // Check if queue will be empty after this
      if (rating !== 1 && queue.length <= 1) {
        setSessionDone(true);
      } else if (rating === 1 && queue.length <= 1) {
        // Only the "Again" card remains — it cycles back
      }
    }, 200);
  }, [currentCard, queue, reviewMutation, animatingOut]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed && currentCard) {
          setRevealed(true);
        }
      }
      if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        handleRate(parseInt(e.key));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, handleRate, currentCard]);

  // Loading
  if (dueQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground">Loading your review queue...</div>
        </div>
      </div>
    );
  }

  // No cards due
  if (initialized && totalToReview === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2">All caught up</h1>
          <p className="text-sm text-muted-foreground mb-6">No cards are due for review right now. Great job staying on top of things.</p>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" data-testid="button-back-dashboard">
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back to dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Session complete
  if (sessionDone || (initialized && queue.length === 0 && completed > 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-xl font-semibold mb-2">Session complete</h1>
          <p className="text-sm text-muted-foreground mb-2">
            You reviewed {completed} card{completed !== 1 ? "s" : ""} this session.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Consistent review is the key to long-term retention. Keep it up.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="w-full" data-testid="button-back-dashboard">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-5 md:px-8 py-3">
          <Link href="/dashboard">
            <button className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm" data-testid="button-exit-study">
              <ArrowLeft className="w-4 h-4" />
              Exit
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {completed} reviewed · {queue.length} remaining
            </span>
            <div className="w-24">
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        </div>
      </header>

      {/* Card */}
      <main className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-lg">
          {currentCard && (
            <div
              ref={cardRef}
              className={`transition-all duration-200 ${animatingOut ? "opacity-0 translate-x-4" : "opacity-100 translate-x-0"}`}
            >
              {/* Question */}
              <Card className="border-border/50 mb-4">
                <CardContent className="p-6 md:p-8">
                  <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">Question</div>
                  <div className="text-base md:text-lg font-medium leading-relaxed" data-testid="text-card-front">
                    {currentCard.front}
                  </div>
                </CardContent>
              </Card>

              {/* Answer */}
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all active:scale-[0.99]"
                  data-testid="button-reveal"
                >
                  Tap to reveal answer
                  <span className="block text-xs text-muted-foreground/60 mt-0.5">or press Space</span>
                </button>
              ) : (
                <>
                  <Card className="border-primary/20 bg-accent/30 mb-6">
                    <CardContent className="p-6 md:p-8">
                      <div className="text-xs text-primary mb-3 uppercase tracking-wider font-medium">Answer</div>
                      <div className="text-base md:text-lg leading-relaxed" data-testid="text-card-back">
                        {currentCard.back}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rating buttons */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center mb-3">How well did you know this?</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {RATING_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => handleRate(opt.value)}
                          disabled={reviewMutation.isPending || animatingOut}
                          className={`p-3 rounded-lg border text-center transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${opt.color}`}
                          data-testid={`button-rate-${opt.value}`}
                        >
                          <div className="text-sm font-semibold">{opt.label}</div>
                          <div className="text-[10px] opacity-70 mt-0.5">{opt.description}</div>
                          <div className="text-[10px] opacity-40 mt-1">
                            <Keyboard className="w-2.5 h-2.5 inline mr-0.5" />
                            {opt.key}
                          </div>
                        </button>
                      ))}
                    </div>
                    {queue.length > 1 && (
                      <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
                        "Again" cards will reappear at the end of this session
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
