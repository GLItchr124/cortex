import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";

// Simple password hashing (for demo — production would use bcrypt)
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const check = createHash("sha256").update(password + salt).digest("hex");
  return check === hash;
}

// Simple session store (in-memory)
const sessions: Map<string, { userId: string; expiresAt: number }> = new Map();

function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }); // 7 days
  return token;
}

function getSession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

// Auth middleware
function authMiddleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const token = authHeader.substring(7);
  const userId = getSession(token);
  if (!userId) {
    return res.status(401).json({ message: "Session expired" });
  }
  (req as any).userId = userId;
  next();
}

// SM-2 spaced repetition algorithm
// easeFactor is stored as integer ×100 (e.g. 250 = 2.50)
function calculateNextReview(quality: number, repetitions: number, easeFactor: number, interval: number) {
  // quality: 1=Again, 2=Hard, 3=Good, 4=Easy
  // Map to SM-2 scale (0-5): 1→0, 2→2, 3→4, 4→5
  const q = quality === 1 ? 0 : quality === 2 ? 2 : quality === 3 ? 4 : 5;
  
  let newInterval: number;
  let newReps: number;

  if (q < 3) {
    // Failed — reset repetitions, review again soon
    newReps = 0;
    newInterval = 0;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) {
      newInterval = 1; // 1 day
    } else if (newReps === 2) {
      newInterval = 3; // 3 days
    } else {
      // interval × EF (EF stored as int×100, so divide by 100)
      newInterval = Math.max(1, Math.round(interval * (easeFactor / 100)));
    }
  }
  
  // Update ease factor using SM-2 formula
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  // Since EF is stored ×100, multiply the delta by 100:
  // delta×100 = 10 - (5-q)*(8 + (5-q)*2)
  const delta = 10 - (5 - q) * (8 + (5 - q) * 2);
  let newEF = easeFactor + delta;
  if (newEF < 130) newEF = 130; // minimum EF = 1.30
  
  // Easy bonus: 30% longer interval
  if (quality === 4 && newInterval > 0) {
    newInterval = Math.round(newInterval * 1.3);
  }
  
  // Hard penalty: slightly shorter interval
  if (quality === 2 && newInterval > 1) {
    newInterval = Math.max(1, Math.round(newInterval * 0.8));
  }
  
  const nextReview = new Date();
  if (newInterval === 0) {
    // "Again" — review again in 1 minute (allows re-queue within session)
    nextReview.setTime(nextReview.getTime() + 60 * 1000);
  } else {
    nextReview.setDate(nextReview.getDate() + newInterval);
    // Set to start of next day to avoid time-of-day precision issues
    nextReview.setHours(0, 0, 0, 0);
  }
  
  return {
    interval: newInterval,
    easeFactor: Math.round(newEF),
    repetitions: newReps,
    nextReview,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // =================== AUTH ===================
  
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        displayName: z.string().optional(),
        source: z.string().optional(),
        campaign: z.string().optional(),
      });
      
      const data = schema.parse(req.body);
      
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const user = await storage.createUser({
        email: data.email,
        password: hashPassword(data.password),
        displayName: data.displayName || null,
        source: data.source || null,
        campaign: data.campaign || null,
      });
      
      // Log signup — isolated try/catch so signup always succeeds even if logging fails
      try {
        await storage.createSignupLog({
          emailOrPhone: data.email,
          source: data.source || null,
          campaign: data.campaign || null,
        });
      } catch (logError) {
        console.error("Failed to create signup log (user was still created):", logError);
      }
      
      const token = createSession(user.id);
      
      res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      
      if (!user || !verifyPassword(data.password, user.password)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      const token = createSession(user.id);
      
      res.json({
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: error.message });
    }
  });
  
  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    const user = await storage.getUser((req as any).userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, email: user.email, displayName: user.displayName });
  });
  
  // =================== DECKS ===================
  
  app.get("/api/decks", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const decks = await storage.getDecksByUser(userId);
    // Add card counts
    const enriched = await Promise.all(decks.map(async (d) => {
      const cards = await storage.getCardsByDeck(d.id);
      const now = new Date();
      const dueCount = cards.filter(c => new Date(c.nextReview) <= now).length;
      return { ...d, totalCards: cards.length, dueCount };
    }));
    res.json(enriched);
  });
  
  app.post("/api/decks", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const deck = await storage.createDeck({ ...data, userId: (req as any).userId, description: data.description || null, color: data.color || null });
      res.json(deck);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  app.delete("/api/decks/:id", authMiddleware, async (req: Request, res: Response) => {
    const deck = await storage.getDeck(req.params.id);
    if (!deck || deck.userId !== (req as any).userId) {
      return res.status(404).json({ message: "Deck not found" });
    }
    await storage.deleteDeck(req.params.id);
    res.json({ success: true });
  });
  
  // =================== CARDS ===================
  
  app.get("/api/cards", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const deckId = req.query.deckId as string | undefined;
    if (deckId) {
      const cards = await storage.getCardsByDeck(deckId);
      res.json(cards.filter(c => c.userId === userId));
    } else {
      const cards = await storage.getCardsByUser(userId);
      res.json(cards);
    }
  });
  
  app.post("/api/cards", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        deckId: z.string(),
        front: z.string().min(1),
        back: z.string().min(1),
        tags: z.string().optional(),
        sourceLink: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const card = await storage.createCard({
        ...data,
        userId: (req as any).userId,
        tags: data.tags || null,
        sourceLink: data.sourceLink || null,
      });
      res.json(card);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  app.delete("/api/cards/:id", authMiddleware, async (req: Request, res: Response) => {
    const card = await storage.getCard(req.params.id);
    if (!card || card.userId !== (req as any).userId) {
      return res.status(404).json({ message: "Card not found" });
    }
    await storage.deleteCard(req.params.id);
    res.json({ success: true });
  });
  
  // =================== STUDY / REVIEW ===================
  
  app.get("/api/study/due", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const deckId = req.query.deckId as string | undefined;
    let dueCards = await storage.getDueCards(userId);
    if (deckId) {
      dueCards = dueCards.filter(c => c.deckId === deckId);
    }
    res.json(dueCards);
  });
  
  app.post("/api/study/review", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        cardId: z.string(),
        rating: z.number().min(1).max(4),
      });
      const data = schema.parse(req.body);
      const userId = (req as any).userId;
      
      const card = await storage.getCard(data.cardId);
      if (!card || card.userId !== userId) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Calculate next review using SM-2
      const result = calculateNextReview(
        data.rating,
        card.repetitions,
        card.easeFactor,
        card.interval
      );
      
      // Update card
      await storage.updateCard(card.id, {
        interval: result.interval,
        easeFactor: result.easeFactor,
        repetitions: result.repetitions,
        nextReview: result.nextReview,
        lastReview: new Date(),
      });
      
      // Log the review
      await storage.createReviewLog({
        userId,
        cardId: data.cardId,
        rating: data.rating,
      });
      
      res.json({
        success: true,
        nextReview: result.nextReview,
        interval: result.interval,
        repetitions: result.repetitions,
        easeFactor: result.easeFactor,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // =================== DASHBOARD STATS ===================
  
  app.get("/api/stats", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const totalCards = (await storage.getCardsByUser(userId)).length;
    const dueToday = (await storage.getDueCards(userId)).length;
    const completedToday = await storage.getTodayReviewCount(userId);
    const streak = await storage.getStreak(userId);
    
    res.json({ totalCards, dueToday, completedToday, streak });
  });
  
  // =================== ADMIN / EXPORT ===================
  
  app.get("/api/admin/signups", async (req: Request, res: Response) => {
    // Simple admin key check
    const key = req.query.key as string;
    if (key !== "cortex-admin-2026") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const logs = await storage.getAllSignupLogs();
    res.json(logs);
  });
  
  app.get("/api/admin/signups/csv", async (req: Request, res: Response) => {
    const key = req.query.key as string;
    if (key !== "cortex-admin-2026") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const logs = await storage.getAllSignupLogs();
    const csv = "id,email_or_phone,date_time,source,campaign\n" +
      logs.map(l => `${l.id},${l.emailOrPhone},${l.dateTime.toISOString()},${l.source || ""},${l.campaign || ""}`).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=signups.csv");
    res.send(csv);
  });
  
  // =================== CARD EDITING ===================
  
  app.patch("/api/cards/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        front: z.string().min(1).optional(),
        back: z.string().min(1).optional(),
        tags: z.string().nullable().optional(),
        sourceLink: z.string().nullable().optional(),
      });
      const data = schema.parse(req.body);
      const card = await storage.getCard(req.params.id);
      if (!card || card.userId !== (req as any).userId) {
        return res.status(404).json({ message: "Card not found" });
      }
      const updated = await storage.updateCard(req.params.id, data);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // =================== DECK EDITING ===================
  
  app.patch("/api/decks/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        color: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const deck = await storage.getDeck(req.params.id);
      if (!deck || deck.userId !== (req as any).userId) {
        return res.status(404).json({ message: "Deck not found" });
      }
      const updated = await storage.updateDeck(req.params.id, data);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // =================== STUDY HISTORY ===================
  
  app.get("/api/study/history", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const logs = await storage.getReviewLogsByUser(userId);
    // Return last 200 review logs, newest first
    const sorted = logs.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime()).slice(0, 200);
    res.json(sorted);
  });
  
  // =================== DECK STATS ===================
  
  app.get("/api/decks/:id/stats", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const deck = await storage.getDeck(req.params.id);
    if (!deck || deck.userId !== userId) {
      return res.status(404).json({ message: "Deck not found" });
    }
    const allCards = await storage.getCardsByDeck(req.params.id);
    const now = new Date();
    const dueCount = allCards.filter(c => new Date(c.nextReview) <= now).length;
    const newCount = allCards.filter(c => c.repetitions === 0).length;
    const learningCount = allCards.filter(c => c.repetitions > 0 && c.interval < 21).length;
    const matureCount = allCards.filter(c => c.interval >= 21).length;
    const avgEase = allCards.length > 0 ? Math.round(allCards.reduce((s, c) => s + c.easeFactor, 0) / allCards.length) : 250;
    
    res.json({
      totalCards: allCards.length,
      dueCount,
      newCount,
      learningCount,
      matureCount,
      avgEase,
    });
  });
  
  // =================== IMPORT (text to cards) ===================
  
  app.post("/api/import/text", authMiddleware, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        text: z.string().min(1),
        deckId: z.string(),
      });
      const data = schema.parse(req.body);
      const userId = (req as any).userId;
      
      // Simple heuristic: split by newlines, look for Q: A: patterns or bullet points
      const lines = data.text.split("\n").map(l => l.trim()).filter(Boolean);
      const suggestions: { front: string; back: string }[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Pattern: "Q: ... A: ..."
        const qaMatch = line.match(/^Q:\s*(.+?)\s*A:\s*(.+)$/i);
        if (qaMatch) {
          suggestions.push({ front: qaMatch[1], back: qaMatch[2] });
          continue;
        }
        
        // Pattern: "Question? Answer"
        const questionMark = line.indexOf("?");
        if (questionMark > 5 && questionMark < line.length - 3) {
          suggestions.push({
            front: line.substring(0, questionMark + 1).trim(),
            back: line.substring(questionMark + 1).trim(),
          });
          continue;
        }
        
        // Pattern: "Term - Definition" or "Term: Definition"
        const separatorMatch = line.match(/^(.{3,50})\s*[-:–]\s*(.{5,})$/);
        if (separatorMatch) {
          suggestions.push({ front: `What is ${separatorMatch[1].trim()}?`, back: separatorMatch[2].trim() });
          continue;
        }
        
        // Pattern: consecutive lines as Q/A pairs
        if (i + 1 < lines.length && line.length < 80 && lines[i + 1].length > 10) {
          const nextLine = lines[i + 1];
          if (!nextLine.match(/^Q:|^-|^\d+\.|^•/i)) {
            suggestions.push({ front: line, back: nextLine });
            i++; // skip next line
          }
        }
      }
      
      res.json({ suggestions });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // =================== HEALTH CHECK (Railway) ===================
  
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  return httpServer;
}
