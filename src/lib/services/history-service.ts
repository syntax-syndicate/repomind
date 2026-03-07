import { kv } from "@vercel/kv";

export interface SearchHistoryItem {
    query: string;
    type: "profile" | "repo";
    timestamp: number;
}

export async function recordSearch(userId: string, query: string, type: "profile" | "repo") {
    const key = `user:${userId}:recent_searches`;

    // Get existing searches to avoid duplicates
    const existingSearches = await kv.lrange<SearchHistoryItem>(key, 0, 50);

    // Remove if already exists (to move it to top)
    const filteredSearches = existingSearches.filter(item => item.query !== query);

    const newItem: SearchHistoryItem = {
        query,
        type,
        timestamp: Date.now()
    };

    // Clear and refill list (KV doesn't have a direct "remove and push to front" for complex objects easily without LREM which works on exact values)
    // For simplicity with KV, we can just LPUSH and then filter unique ones when retrieving, or do this:

    await kv.del(key);
    const newItems = [newItem, ...filteredSearches].slice(0, 10); // Keep last 10

    // Use pipeline or loop to lpush
    if (newItems.length > 0) {
        // Reverse because LPUSH adds to front, so we want the newest to be added last if we were doing it one by one, 
        // but here we can just push them all. Actually LPUSH [a, b, c] results in [c, b, a].
        // So we should reverse our array.
        await kv.lpush(key, ...newItems.reverse());
    }
}

export async function getRecentSearches(userId: string, limit: number = 3): Promise<SearchHistoryItem[]> {
    const key = `user:${userId}:recent_searches`;
    const searches = await kv.lrange<SearchHistoryItem>(key, 0, limit - 1);
    return searches;
}
