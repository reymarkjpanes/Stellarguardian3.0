/**
 * Price oracle service — XLM/USD price for display purposes.
 * Uses Stellar Expert API or cached fallback.
 */
import "server-only";
import { logger } from "@/lib/logger";

interface PriceData {
  xlm_usd: number;
  updated_at: string;
}

let cachedPrice: PriceData | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current XLM/USD price.
 * Caches for 5 minutes to avoid rate limits.
 */
export async function getXlmUsdPrice(): Promise<PriceData> {
  // Return cached value if fresh
  if (cachedPrice && Date.now() - new Date(cachedPrice.updated_at).getTime() < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    // Primary: CoinGecko simple price endpoint
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
      { next: { revalidate: 300 } },
    );

    if (res.ok) {
      const data = await res.json();
      const price = data?.stellar?.usd;
      if (typeof price === "number" && price > 0) {
        cachedPrice = { xlm_usd: price, updated_at: new Date().toISOString() };
        return cachedPrice;
      }
    }
  } catch (err) {
    logger.warn("Price oracle primary source failed", { error: String(err) });
  }

  try {
    // Fallback: Stellar Expert
    const res = await fetch("https://api.stellar.expert/explorer/public/xlm-price", {
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data[0] === "number") {
        cachedPrice = { xlm_usd: data[0], updated_at: new Date().toISOString() };
        return cachedPrice;
      }
    }
  } catch (err) {
    logger.warn("Price oracle fallback source failed", { error: String(err) });
  }

  // Return stale cache or default
  if (cachedPrice) return cachedPrice;
  return { xlm_usd: 0.1, updated_at: new Date().toISOString() }; // Safe fallback
}

/**
 * Convert XLM amount to USD (approximate).
 */
export async function xlmToUsd(xlmAmount: number): Promise<number> {
  const price = await getXlmUsdPrice();
  return xlmAmount * price.xlm_usd;
}
