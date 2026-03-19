import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  source: text("source"),
  campaign: text("campaign"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Decks
export const decks = pgTable("decks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
});

export const insertDeckSchema = createInsertSchema(decks).omit({ id: true });
export type InsertDeck = z.infer<typeof insertDeckSchema>;
export type Deck = typeof decks.$inferSelect;

// Cards
export const cards = pgTable("cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  deckId: varchar("deck_id").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  tags: text("tags"),
  sourceLink: text("source_link"),
  // Spaced repetition fields
  interval: integer("interval").default(0).notNull(), // days until next review
  easeFactor: integer("ease_factor").default(250).notNull(), // x100 for int storage (2.50)
  repetitions: integer("repetitions").default(0).notNull(),
  nextReview: timestamp("next_review").defaultNow().notNull(),
  lastReview: timestamp("last_review"),
});

export const insertCardSchema = createInsertSchema(cards).omit({
  id: true,
  interval: true,
  easeFactor: true,
  repetitions: true,
  nextReview: true,
  lastReview: true,
});
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;

// Review logs
export const reviewLogs = pgTable("review_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  cardId: varchar("card_id").notNull(),
  rating: integer("rating").notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
  reviewedAt: timestamp("reviewed_at").defaultNow().notNull(),
});

export const insertReviewLogSchema = createInsertSchema(reviewLogs).omit({
  id: true,
  reviewedAt: true,
});
export type InsertReviewLog = z.infer<typeof insertReviewLogSchema>;
export type ReviewLog = typeof reviewLogs.$inferSelect;

// Subscriptions (Pro tier — DISABLED until 500 users)
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  tier: text("tier").default("free").notNull(), // "free" | "pro"
  status: text("status").default("active").notNull(), // "active" | "cancelled" | "past_due"
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  tokenBalance: integer("token_balance").default(0).notNull(), // For future token/credit system
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Feature flags — controls what's available per tier
export const FEATURE_FLAGS = {
  FREE_CARD_LIMIT: 500,        // Max cards on free tier
  FREE_DECK_LIMIT: 20,         // Max decks on free tier
  PRO_CARD_LIMIT: Infinity,    // Unlimited cards
  PRO_DECK_LIMIT: Infinity,    // Unlimited decks
  PAYMENTS_ENABLED: false,     // Set to true when 500+ users
  TOKEN_SYSTEM_ENABLED: false, // Future token/credit monetization
} as const;

// Signup log (for admin export)
export const signupLogs = pgTable("signup_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailOrPhone: text("email_or_phone").notNull(),
  dateTime: timestamp("date_time").defaultNow().notNull(),
  source: text("source"),
  campaign: text("campaign"),
});

export const insertSignupLogSchema = createInsertSchema(signupLogs).omit({
  id: true,
  dateTime: true,
});
export type InsertSignupLog = z.infer<typeof insertSignupLogSchema>;
export type SignupLog = typeof signupLogs.$inferSelect;
