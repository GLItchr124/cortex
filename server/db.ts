import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pg;

let db: ReturnType<typeof drizzle> | null = null;
let pool: InstanceType<typeof Pool> | null = null;

export function getDb() {
  if (!db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
  }
  return db;
}

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

// Create tables if they don't exist (simpler than running migrations)
export async function initializeDatabase() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT,
      source TEXT,
      campaign TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decks (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1'
    );

    CREATE TABLE IF NOT EXISTS cards (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      deck_id VARCHAR NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      tags TEXT,
      source_link TEXT,
      interval INTEGER DEFAULT 0 NOT NULL,
      ease_factor INTEGER DEFAULT 250 NOT NULL,
      repetitions INTEGER DEFAULT 0 NOT NULL,
      next_review TIMESTAMP DEFAULT NOW() NOT NULL,
      last_review TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL,
      card_id VARCHAR NOT NULL,
      rating INTEGER NOT NULL,
      reviewed_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signup_logs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      email_or_phone TEXT NOT NULL,
      date_time TIMESTAMP DEFAULT NOW() NOT NULL,
      source TEXT,
      campaign TEXT
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR NOT NULL UNIQUE,
      tier TEXT DEFAULT 'free' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      current_period_end TIMESTAMP,
      token_balance INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(user_id, next_review);
    CREATE INDEX IF NOT EXISTS idx_review_logs_user ON review_logs(user_id, reviewed_at);
    CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
  `);
  console.log("Database tables initialized");
}
