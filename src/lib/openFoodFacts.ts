// ============================================================================
// Open Food Facts – EAN lookup
// Docs: https://world.openfoodfacts.org/data
// Zdarma, ~3M produktů, 85% hit rate pro potraviny v EU.
// ============================================================================
import type { Category } from '@/src/types/database';

export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: Category | null;
  image_url: string | null;
  quantity: string | null; // "500 g", "1 l" – raw text z OFF
}

interface OffApiResponse {
  status: 0 | 1;
  status_verbose?: string;
  code?: string;
  product?: {
    product_name?: string;
    product_name_cs?: string;
    generic_name?: string;
    brands?: string;
    categories_tags?: string[];
    image_url?: string;
    image_front_url?: string;
    image_front_small_url?: string;
    quantity?: string;
  };
}

/**
 * Heuristické mapování OFF kategorií na naše domain kategorie.
 * OFF category tag má tvar "en:dairy", "cs:nápoje", atd.
 */
function mapCategory(tags: string[] | undefined): Category | null {
  if (!tags || tags.length === 0) return null;
  const joined = tags.join(' ').toLowerCase();

  // Léky / drogerie
  if (/medicine|pharmac|drug|medicament|lék|vitamin/.test(joined)) return 'léky';

  // Voda
  if (/mineral-water|spring-water|drinking-water|water\b|voda/.test(joined)) return 'voda';

  // Dezinfekce / hygiena
  if (/disinfect|sanit|hygien|dezinf|cleaner|soap|mýdlo/.test(joined)) return 'dezinfekce';

  // Energie / baterie
  if (/battery|baterie|energy-drink/.test(joined)) return 'energie';

  // Vše ostatní potravinové → potraviny
  if (/food|beverage|dairy|meat|fish|vegetable|fruit|cereal|snack|bread|cheese|pasta|drink|juice|coffee|tea|potraviny|nápoj|pečivo|mléko|maso/.test(joined))
    return 'potraviny';

  return null;
}

/**
 * Vybere nejlepší název – preferuje český, pak anglický, pak generický.
 */
function pickName(p: NonNullable<OffApiResponse['product']>): string {
  const candidates = [p.product_name_cs, p.product_name, p.generic_name]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return candidates[0]?.trim() ?? 'Neznámý produkt';
}

/**
 * Lookup produktu dle EAN/UPC kódu.
 * - Vrátí `null` pokud produkt v OFF není (status=0).
 * - Hodí error pouze při network failure.
 */
export async function lookupByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        // OFF prosí o identifikaci klienta
        'User-Agent': 'Stockr/1.0 (https://github.com/ondrejmichalcik/stockr)',
      },
    });
  } catch (e) {
    throw new Error('Nelze se připojit k Open Food Facts.');
  }

  if (!response.ok) {
    throw new Error(`Open Food Facts: HTTP ${response.status}`);
  }

  const json = (await response.json()) as OffApiResponse;
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  return {
    barcode,
    name: pickName(p),
    brand: p.brands?.split(',')[0]?.trim() ?? null,
    category: mapCategory(p.categories_tags),
    image_url: p.image_front_url ?? p.image_url ?? p.image_front_small_url ?? null,
    quantity: p.quantity ?? null,
  };
}
