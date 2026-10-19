import { api, Food } from "./api";
import { cacheFoods, getPendingLogs, markSynced } from "./db";

export async function syncFoods(): Promise<number> {
  const result = await api<{ items: Food[] }>("/api/foods?limit=100&verifiedOnly=true");
  await cacheFoods(result.items);
  return result.items.length;
}

export async function flushPendingLogs(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingLogs();
  let synced = 0;
  let failed = 0;

  for (const log of pending) {
    try {
      await api("/api/meals", {
        method: "POST",
        body: JSON.stringify({
          foodId: log.foodId,
          portionMultiplier: log.portionMultiplier,
          mealType: log.mealType,
          loggedAt: log.loggedAt,
          notes: log.notes ?? undefined,
          clientUuid: log.clientUuid,
        }),
      });
      await markSynced(log.clientUuid);
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}
