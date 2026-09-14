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
        'User-Agent': 'Noura/0.14 (food diary barcode lookup)',
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

export type FoodSearchResult = BarcodeFoodProduct & { source: 'openfoodfacts' | 'catalog' };

const COMMON_FOODS: Array<{name:string;aliases:string[];kcal?:number;protein?:number;carbs?:number;fat?:number;servingSize?:string}> = [
  {name:'Banane',aliases:['banana'],kcal:89,protein:1.1,carbs:22.8,fat:0.3,servingSize:'1 Stück'},
  {name:'Apfel',aliases:['apple'],kcal:52,protein:0.3,carbs:13.8,fat:0.2,servingSize:'1 Stück'},
  {name:'Haferflocken',aliases:['oats','porridge'],kcal:372,protein:13.5,carbs:58.7,fat:7,servingSize:'60 g'},
  {name:'Naturjoghurt',aliases:['joghurt','yogurt'],kcal:61,protein:3.5,carbs:4.7,fat:3.3,servingSize:'150 g'},
  {name:'Skyr',aliases:['skyr natur'],kcal:63,protein:11,carbs:4,fat:0.2,servingSize:'150 g'},
  {name:'Kuhmilch 3,5 %',aliases:['milch','vollmilch'],kcal:64,protein:3.3,carbs:4.8,fat:3.5,servingSize:'200 ml'},
  {name:'Haferdrink',aliases:['hafermilch','oat milk'],kcal:46,protein:1,carbs:7.7,fat:1.5,servingSize:'200 ml'},
  {name:'Reis gekocht',aliases:['reis','rice'],kcal:130,protein:2.7,carbs:28,fat:0.3,servingSize:'200 g'},
  {name:'Pasta gekocht',aliases:['nudeln','spaghetti','pasta'],kcal:157,protein:5.8,carbs:30.9,fat:0.9,servingSize:'250 g'},
  {name:'Vollkornbrot',aliases:['brot','vollkorn'],kcal:247,protein:8.5,carbs:41,fat:3.4,servingSize:'1 Scheibe'},
  {name:'Ei gekocht',aliases:['ei','egg'],kcal:155,protein:13,carbs:1.1,fat:11,servingSize:'1 Stück'},
  {name:'Hähnchenbrust',aliases:['hähnchen','chicken'],kcal:165,protein:31,carbs:0,fat:3.6,servingSize:'150 g'},
  {name:'Lachs',aliases:['salmon'],kcal:208,protein:20,carbs:0,fat:13,servingSize:'150 g'},
  {name:'Kartoffeln gekocht',aliases:['kartoffel','potato'],kcal:87,protein:1.9,carbs:20.1,fat:0.1,servingSize:'250 g'},
  {name:'Kaffee schwarz',aliases:['kaffee','coffee'],kcal:2,protein:0.3,carbs:0,fat:0,servingSize:'1 Tasse'},
  {name:'Latte Macchiato',aliases:['latte','milchkaffee'],kcal:45,protein:2.5,carbs:4.5,fat:2.2,servingSize:'250 ml'},
];

function searchCatalog(query:string,limit:number):FoodSearchResult[]{
  const q=query.trim().toLowerCase(); if(q.length<2)return [];
  return COMMON_FOODS.map((x,index)=>{const hay=[x.name,...x.aliases].join(' ').toLowerCase(); const pos=hay.indexOf(q); return {x,index,score:pos===0?0:pos>=0?1:99};}).filter(r=>r.score<99).sort((a,b)=>a.score-b.score||a.index-b.index).slice(0,limit).map(({x,index})=>({barcode:`catalog-${index}`,name:x.name,servingSize:x.servingSize,allergens:[],nutritionPer100g:{kcal:x.kcal,protein:x.protein,carbs:x.carbs,fat:x.fat},source:'catalog'}));
}


export async function searchFoodProducts(query: string, limit = 12): Promise<FoodSearchResult[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];
  const local = searchCatalog(clean, Math.min(6, limit));
  const fields = [
    'code','product_name','product_name_de','product_name_en','abbreviated_product_name','generic_name','generic_name_de',
    'brands','quantity','serving_size','image_front_small_url','image_front_url','ingredients_text','ingredients_text_de','allergens_tags','nutriments',
  ].join(',');
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&search_simple=1&json=1&page_size=${Math.max(1, Math.min(30, limit))}&fields=${encodeURIComponent(fields)}&search_terms=${encodeURIComponent(clean)}`;
    const data = await fetchJsonWithTimeout(url, 12000);
    const products = Array.isArray(data?.products) ? data.products : [];
    const mapped: FoodSearchResult[] = [...local];
    const seen = new Set(local.map(x=>`${x.name.toLowerCase()}|${(x.brand||'').toLowerCase()}`));
    for (const raw of products) {
      const code = String(raw?.code || '').trim();
      const product = mapProduct(raw, code || `search-${mapped.length}`);
      if (!product) continue;
      const key = `${product.name.toLowerCase()}|${(product.brand || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mapped.push({ ...product, source: 'openfoodfacts' });
      if (mapped.length >= limit) break;
    }
    return mapped.slice(0,limit);
  } catch (error) {
    if (local.length) return local;
    throw error;
  }
}

