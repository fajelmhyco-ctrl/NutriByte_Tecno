import * as SQLite from "expo-sqlite";
import { DailySummary, Food, MealTotals } from "./api";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("nutribyte.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS foods (
          id TEXT PRIMARY KEY,
          dishName TEXT NOT NULL,
          localName TEXT,
          category TEXT NOT NULL,
          servingUnit TEXT NOT NULL,
          calories REAL NOT NULL,
          proteinG REAL NOT NULL,
          carbsG REAL NOT NULL,
          fatG REAL NOT NULL,
          sodiumMg REAL NOT NULL,
          potassiumMg REAL NOT NULL,
          phosphorusMg REAL NOT NULL,
          glycemicIndex REAL,
          glycemicLoad REAL,
          commonIngredients TEXT NOT NULL DEFAULT '[]',
          isVerified INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pending_logs (
          clientUuid TEXT PRIMARY KEY,
          foodId TEXT NOT NULL,
          portionMultiplier REAL NOT NULL,
          mealType TEXT NOT NULL,
          loggedAt TEXT NOT NULL,
          notes TEXT,
          synced INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cached_summary (
          date TEXT PRIMARY KEY,
          payload TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_pending_synced ON pending_logs(synced);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export interface PendingLog {
  clientUuid: string;
  foodId: string;
  portionMultiplier: number;
  mealType: string;
  loggedAt: string;
  notes: string | null;
  synced: number;
  createdAt: string;
}

export async function cacheFoods(foods: Food[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const food of foods) {
      await db.runAsync(
        `INSERT OR REPLACE INTO foods (
          id, dishName, localName, category, servingUnit, calories, proteinG, carbsG, fatG,
          sodiumMg, potassiumMg, phosphorusMg, glycemicIndex, glycemicLoad, commonIngredients, isVerified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          food.id,
          food.dishName,
          food.localName,
          food.category,
          food.servingUnit,
          food.calories,
          food.proteinG,
          food.carbsG,
          food.fatG,
          food.sodiumMg,
          food.potassiumMg,
          food.phosphorusMg,
          food.glycemicIndex,
          food.glycemicLoad,
          JSON.stringify(food.commonIngredients ?? []),
          food.isVerified ? 1 : 0,
        ],
      );
    }
  });
}

export async function searchFoodsOffline(query: string, limit = 30): Promise<Food[]> {
  const db = await getDb();
  const like = `%${query}%`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM foods
     WHERE dishName LIKE ? OR localName LIKE ?
     ORDER BY isVerified DESC, dishName ASC
     LIMIT ?`,
    [like, like, limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    dishName: String(row.dishName),
    localName: row.localName ? String(row.localName) : null,
    category: String(row.category),
    servingUnit: String(row.servingUnit),
    calories: Number(row.calories),
    proteinG: Number(row.proteinG),
    carbsG: Number(row.carbsG),
    fatG: Number(row.fatG),
    sodiumMg: Number(row.sodiumMg),
    potassiumMg: Number(row.potassiumMg),
    phosphorusMg: Number(row.phosphorusMg),
    glycemicIndex: row.glycemicIndex == null ? null : Number(row.glycemicIndex),
    glycemicLoad: row.glycemicLoad == null ? null : Number(row.glycemicLoad),
    commonIngredients: JSON.parse(String(row.commonIngredients ?? "[]")),
    isVerified: Boolean(row.isVerified),
  }));
}

export async function queueMealLog(input: {
  foodId: string;
  portionMultiplier: number;
  mealType: string;
  loggedAt: string;
  notes?: string;
}): Promise<string> {
  const db = await getDb();
  const clientUuid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.runAsync(
    `INSERT INTO pending_logs (clientUuid, foodId, portionMultiplier, mealType, loggedAt, notes, synced, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      clientUuid,
      input.foodId,
      input.portionMultiplier,
      input.mealType,
      input.loggedAt,
      input.notes ?? null,
      new Date().toISOString(),
    ],
  );
  return clientUuid;
}

export async function getPendingLogs(): Promise<PendingLog[]> {
  const db = await getDb();
  return db.getAllAsync<PendingLog>(
    "SELECT * FROM pending_logs WHERE synced = 0 ORDER BY createdAt ASC",
  );
}

export async function markSynced(clientUuid: string) {
  const db = await getDb();
  await db.runAsync("UPDATE pending_logs SET synced = 1 WHERE clientUuid = ?", [clientUuid]);
}

export async function cacheSummary(summary: DailySummary) {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO cached_summary (date, payload, updatedAt) VALUES (?, ?, ?)",
    [summary.date, JSON.stringify(summary), new Date().toISOString()],
  );
}

export async function getCachedSummary(date: string): Promise<DailySummary | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    "SELECT payload FROM cached_summary WHERE date = ?",
    [date],
  );
  return row ? (JSON.parse(row.payload) as DailySummary) : null;
}

export function emptyTotals(): MealTotals {
  return {
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    sodiumMg: 0,
    potassiumMg: 0,
    phosphorusMg: 0,
    glycemicLoad: 0,
  };
}
