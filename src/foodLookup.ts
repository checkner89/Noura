export type ProductNutrition = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugars?: number;
  fiber?: number;
};

export type BarcodeFoodProduct = {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: string;
  servingSize?: string;
  imageUrl?: string;
  ingredients?: string;
  allergens: string[];
  nutritionPer100g: ProductNutrition;
};

const ALLERGEN_LABELS: Record<string, string> = {
  milk: 'Milch',
  eggs: 'Ei',
  gluten: 'Gluten',
  wheat: 'Weizen',
  soybeans: 'Soja',
  soy: 'Soja',
  peanuts: 'Erdnüsse',
  nuts: 'Schalenfrüchte',
  almonds: 'Mandeln',
  hazelnuts: 'Haselnüsse',
  walnuts: 'Walnüsse',
  cashews: 'Cashewkerne',
  celery: 'Sellerie',
  mustard: 'Senf',
  sesame: 'Sesam',
  fish: 'Fisch',
  crustaceans: 'Krebstiere',
  molluscs: 'Weichtiere',
  lupin: 'Lupine',
  'sulphur-dioxide-and-sulphites': 'Sulfite',
};

function finite(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : undefined;
}

function cleanAllergen(tag: string): string {
  const raw = tag.replace(/^[a-z]{2}:/i, '').toLowerCase();
  if (ALLERGEN_LABELS[raw]) return ALLERGEN_LABELS[raw];
  return raw
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cleanBarcode(input: string) {
  const compact = input.trim().replace(/[\s-]+/g, '');
  const digits = compact.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 14 ? digits : compact;
}

function barcodeCandidates(input: string): string[] {
  const code = cleanBarcode(input);
  const candidates = [code];
  if (/^\d{12}$/.test(code)) candidates.push(`0${code}`);
  if (/^0\d{12}$/.test(code)) candidates.push(code.slice(1));
  return [...new Set(candidates.filter(Boolean))];
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Noura/0.10 (food diary barcode lookup)',
      },
    });
    if (!response.ok) {
      throw new Error(`Produktdaten konnten nicht geladen werden (HTTP ${response.status}).`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Die Produktsuche hat zu lange gedauert. Bitte versuche es erneut.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function mapProduct(product: any, barcode: string): BarcodeFoodProduct | null {
  if (!product) return null;
  const nutrients = product.nutriments || {};
  let kcal = finite(nutrients['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = finite(nutrients.energy_100g);
    if (kj !== undefined) kcal = Math.round((kj / 4.184) * 10) / 10;
  }

  const brand = String(product.brands || '').trim() || undefined;
  const name = String(
    product.product_name_de ||
    product.product_name ||
    product.product_name_en ||
    product.abbreviated_product_name ||
    product.generic_name_de ||
    product.generic_name ||
    brand ||
    '',
  ).trim();

  if (!name) return null;

  const allergens = Array.isArray(product.allergens_tags)
    ? [...new Set(product.allergens_tags.map((tag: unknown) => cleanAllergen(String(tag))).filter(Boolean))] as string[]
    : [];

  return {
    barcode,
    name,
    brand,
    quantity: String(product.quantity || '').trim() || undefined,
    servingSize: String(product.serving_size || '').trim() || undefined,
    imageUrl: String(product.image_front_small_url || product.image_front_url || '').trim() || undefined,
    ingredients: String(product.ingredients_text_de || product.ingredients_text || '').trim() || undefined,
    allergens,
    nutritionPer100g: {
      kcal,
      protein: finite(nutrients.proteins_100g),
      carbs: finite(nutrients.carbohydrates_100g),
      fat: finite(nutrients.fat_100g),
      sugars: finite(nutrients.sugars_100g),
      fiber: finite(nutrients.fiber_100g),
    },
  };
}

export async function lookupFoodByBarcode(barcode: string): Promise<BarcodeFoodProduct | null> {
  const candidates = barcodeCandidates(barcode);
  if (!candidates.length) return null;

  const fields = [
    'code',
    'product_name',
    'product_name_de',
    'product_name_en',
    'abbreviated_product_name',
    'generic_name',
    'generic_name_de',
    'brands',
    'quantity',
    'serving_size',
    'image_front_small_url',
    'image_front_url',
    'ingredients_text',
    'ingredients_text_de',
    'allergens_tags',
    'nutriments',
  ].join(',');

  let lastNetworkError: Error | null = null;

  for (const candidate of candidates) {
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}.json?fields=${encodeURIComponent(fields)}`;
      const data = await fetchJsonWithTimeout(url);
      if (data?.status !== 1 || !data?.product) continue;
      const mapped = mapProduct(data.product, String(data?.code || data?.product?.code || candidate));
      if (mapped) return mapped;
    } catch (error) {
      lastNetworkError = error instanceof Error ? error : new Error('Produktdaten konnten nicht geladen werden.');
    }
  }

  if (lastNetworkError) throw lastNetworkError;
  return null;
}
