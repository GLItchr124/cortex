import {
  type User, type InsertUser,
  type Deck, type InsertDeck,
  type Card, type InsertCard,
  type ReviewLog, type InsertReviewLog,
  type SignupLog, type InsertSignupLog,
  users, decks, cards, reviewLogs, signupLogs,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { getDb } from "./db";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Decks
  getDecksByUser(userId: string): Promise<Deck[]>;
  getDeck(id: string): Promise<Deck | undefined>;
  createDeck(deck: InsertDeck): Promise<Deck>;
  updateDeck(id: string, updates: Partial<Deck>): Promise<Deck | undefined>;
  deleteDeck(id: string): Promise<void>;
  
  // Cards
  getCardsByDeck(deckId: string): Promise<Card[]>;
  getCardsByUser(userId: string): Promise<Card[]>;
  getCard(id: string): Promise<Card | undefined>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined>;
  deleteCard(id: string): Promise<void>;
  getDueCards(userId: string): Promise<Card[]>;
  
  // Review logs
  createReviewLog(log: InsertReviewLog): Promise<ReviewLog>;
  getReviewLogsByUser(userId: string): Promise<ReviewLog[]>;
  getTodayReviewCount(userId: string): Promise<number>;
  getStreak(userId: string): Promise<number>;
  
  // Signup logs
  createSignupLog(log: InsertSignupLog): Promise<SignupLog>;
  getAllSignupLogs(): Promise<SignupLog[]>;
}

// =================== POSTGRES STORAGE ===================

export class PostgresStorage implements IStorage {
  private get db() {
    return getDb();
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }

  // Decks
  async getDecksByUser(userId: string): Promise<Deck[]> {
    return await this.db.select().from(decks).where(eq(decks.userId, userId));
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    const result = await this.db.select().from(decks).where(eq(decks.id, id)).limit(1);
    return result[0];
  }

  async createDeck(insertDeck: InsertDeck): Promise<Deck> {
    const result = await this.db.insert(decks).values(insertDeck).returning();
    return result[0];
  }

  async updateDeck(id: string, updates: Partial<Deck>): Promise<Deck | undefined> {
    const result = await this.db.update(decks).set(updates).where(eq(decks.id, id)).returning();
    return result[0];
  }

  async deleteDeck(id: string): Promise<void> {
    // Delete associated cards first
    await this.db.delete(cards).where(eq(cards.deckId, id));
    await this.db.delete(decks).where(eq(decks.id, id));
  }

  // Cards
  async getCardsByDeck(deckId: string): Promise<Card[]> {
    return await this.db.select().from(cards).where(eq(cards.deckId, deckId));
  }

  async getCardsByUser(userId: string): Promise<Card[]> {
    return await this.db.select().from(cards).where(eq(cards.userId, userId));
  }

  async getCard(id: string): Promise<Card | undefined> {
    const result = await this.db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return result[0];
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const result = await this.db.insert(cards).values(insertCard).returning();
    return result[0];
  }

  async updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined> {
    const result = await this.db.update(cards).set(updates).where(eq(cards.id, id)).returning();
    return result[0];
  }

  async deleteCard(id: string): Promise<void> {
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  async getDueCards(userId: string): Promise<Card[]> {
    return await this.db.select().from(cards).where(
      and(eq(cards.userId, userId), lte(cards.nextReview, new Date()))
    );
  }

  // Review logs
  async createReviewLog(insertLog: InsertReviewLog): Promise<ReviewLog> {
    const result = await this.db.insert(reviewLogs).values(insertLog).returning();
    return result[0];
  }

  async getReviewLogsByUser(userId: string): Promise<ReviewLog[]> {
    return await this.db.select().from(reviewLogs).where(eq(reviewLogs.userId, userId));
  }

  async getTodayReviewCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await this.db.select({ count: sql<number>`count(*)` })
      .from(reviewLogs)
      .where(and(
        eq(reviewLogs.userId, userId),
        gte(reviewLogs.reviewedAt, today)
      ));
    return Number(result[0]?.count ?? 0);
  }

  async getStreak(userId: string): Promise<number> {
    // Get distinct review dates, ordered descending
    const result = await this.db.select({
      reviewDate: sql<string>`DATE(reviewed_at)`,
    })
      .from(reviewLogs)
      .where(eq(reviewLogs.userId, userId))
      .groupBy(sql`DATE(reviewed_at)`)
      .orderBy(sql`DATE(reviewed_at) DESC`);

    if (result.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkDate = new Date(today);

    // Check if user reviewed today
    const firstDate = new Date(result[0].reviewDate);
    firstDate.setHours(0, 0, 0, 0);

    if (firstDate.getTime() !== today.getTime()) {
      // Check if they reviewed yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (firstDate.getTime() !== yesterday.getTime()) {
        return 0; // No recent review
      }
      checkDate = new Date(yesterday);
    }

    for (const row of result) {
      const d = new Date(row.reviewDate);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() === checkDate.getTime()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (d.getTime() < checkDate.getTime()) {
        break;
      }
    }

    return streak;
  }

  // Signup logs
  async createSignupLog(insertLog: InsertSignupLog): Promise<SignupLog> {
    const result = await this.db.insert(signupLogs).values(insertLog).returning();
    return result[0];
  }

  async getAllSignupLogs(): Promise<SignupLog[]> {
    return await this.db.select().from(signupLogs);
  }
}

// =================== IN-MEMORY STORAGE (for local dev without DB) ===================

export class MemStorage implements IStorage {
  private usersMap: Map<string, User> = new Map();
  private decksMap: Map<string, Deck> = new Map();
  private cardsMap: Map<string, Card> = new Map();
  private reviewLogsMap: Map<string, ReviewLog> = new Map();
  private signupLogsMap: Map<string, SignupLog> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.usersMap.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, displayName: insertUser.displayName || null, source: insertUser.source || null, campaign: insertUser.campaign || null, createdAt: new Date() };
    this.usersMap.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.usersMap.values());
  }

  async getDecksByUser(userId: string): Promise<Deck[]> {
    return Array.from(this.decksMap.values()).filter(d => d.userId === userId);
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return this.decksMap.get(id);
  }

  async createDeck(insertDeck: InsertDeck): Promise<Deck> {
    const id = randomUUID();
    const deck: Deck = { ...insertDeck, id, description: insertDeck.description || null, color: insertDeck.color || "#6366f1" };
    this.decksMap.set(id, deck);
    return deck;
  }

  async updateDeck(id: string, updates: Partial<Deck>): Promise<Deck | undefined> {
    const deck = this.decksMap.get(id);
    if (!deck) return undefined;
    const updated = { ...deck, ...updates };
    this.decksMap.set(id, updated);
    return updated;
  }

  async deleteDeck(id: string): Promise<void> {
    this.decksMap.delete(id);
    for (const [cardId, card] of this.cardsMap) {
      if (card.deckId === id) this.cardsMap.delete(cardId);
    }
  }

  async getCardsByDeck(deckId: string): Promise<Card[]> {
    return Array.from(this.cardsMap.values()).filter(c => c.deckId === deckId);
  }

  async getCardsByUser(userId: string): Promise<Card[]> {
    return Array.from(this.cardsMap.values()).filter(c => c.userId === userId);
  }

  async getCard(id: string): Promise<Card | undefined> {
    return this.cardsMap.get(id);
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    const id = randomUUID();
    const card: Card = {
      ...insertCard, id,
      tags: insertCard.tags || null,
      sourceLink: insertCard.sourceLink || null,
      interval: 0, easeFactor: 250, repetitions: 0,
      nextReview: new Date(), lastReview: null,
    };
    this.cardsMap.set(id, card);
    return card;
  }

  async updateCard(id: string, updates: Partial<Card>): Promise<Card | undefined> {
    const card = this.cardsMap.get(id);
    if (!card) return undefined;
    const updated = { ...card, ...updates };
    this.cardsMap.set(id, updated);
    return updated;
  }

  async deleteCard(id: string): Promise<void> {
    this.cardsMap.delete(id);
  }

  async getDueCards(userId: string): Promise<Card[]> {
    const now = new Date();
    return Array.from(this.cardsMap.values()).filter(
      c => c.userId === userId && new Date(c.nextReview) <= now
    );
  }

  async createReviewLog(insertLog: InsertReviewLog): Promise<ReviewLog> {
    const id = randomUUID();
    const log: ReviewLog = { ...insertLog, id, reviewedAt: new Date() };
    this.reviewLogsMap.set(id, log);
    return log;
  }

  async getReviewLogsByUser(userId: string): Promise<ReviewLog[]> {
    return Array.from(this.reviewLogsMap.values()).filter(l => l.userId === userId);
  }

  async getTodayReviewCount(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from(this.reviewLogsMap.values()).filter(
      l => l.userId === userId && new Date(l.reviewedAt) >= today
    ).length;
  }

  async getStreak(userId: string): Promise<number> {
    const logs = Array.from(this.reviewLogsMap.values())
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
    if (logs.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    const reviewedToday = logs.some(l => {
      const d = new Date(l.reviewedAt); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    if (!reviewedToday) checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const dayStart = new Date(checkDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const hasReview = logs.some(l => { const d = new Date(l.reviewedAt); return d >= dayStart && d < dayEnd; });
      if (hasReview) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else { break; }
    }
    return streak;
  }

  async createSignupLog(insertLog: InsertSignupLog): Promise<SignupLog> {
    const id = randomUUID();
    const log: SignupLog = { ...insertLog, id, source: insertLog.source || null, campaign: insertLog.campaign || null, dateTime: new Date() };
    this.signupLogsMap.set(id, log);
    return log;
  }

  async getAllSignupLogs(): Promise<SignupLog[]> {
    return Array.from(this.signupLogsMap.values());
  }
}

// =================== STORAGE INITIALIZATION ===================

// Use Postgres if DATABASE_URL is set, otherwise fall back to in-memory
function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    console.log("Using PostgreSQL storage");
    return new PostgresStorage();
  }
  console.log("No DATABASE_URL set — using in-memory storage (data will not persist across restarts)");
  return new MemStorage();
}

export const storage = createStorage();
