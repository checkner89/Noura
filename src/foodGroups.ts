import { FoodGroupId, FoodItem } from './types';

export const FOOD_GROUP_LABELS: Record<FoodGroupId, string> = {
  dairy: 'Milchprodukte',
  lactose: 'Laktose',
  wheat: 'Weizen',
  gluten: 'Glutenhaltig',
  fructose: 'Fruktosereich',
  polyols: 'Zuckeralkohole',
  caffeine: 'Koffein',
  alcohol: 'Alkohol',
  spicy: 'Scharf',
  'high-fat': 'Fettreich',
};

const MATCHERS: Array<{ id: FoodGroupId; patterns: RegExp[] }> = [
  { id: 'dairy', patterns: [/milch/i, /joghurt/i, /quark/i, /sahne/i, /käse/i, /butter/i, /whey/i, /molke/i, /casein/i, /kasein/i] },
  { id: 'lactose', patterns: [/laktose/i, /milch/i, /joghurt/i, /sahne/i, /molke/i, /milk/i, /lactose/i] },
  { id: 'wheat', patterns: [/weizen/i, /wheat/i, /dinkel/i, /spelt/i, /pasta/i, /nudel/i, /brot/i, /croissant/i] },
  { id: 'gluten', patterns: [/gluten/i, /weizen/i, /dinkel/i, /roggen/i, /gerste/i, /wheat/i, /rye/i, /barley/i] },
  { id: 'fructose', patterns: [/fruktose/i, /fructose/i, /apfel/i, /birne/i, /honig/i, /mango/i, /agave/i, /fruchtsaft/i, /fruit juice/i] },
  { id: 'polyols', patterns: [/sorbit/i, /xylit/i, /mannit/i, /maltit/i, /erythrit/i, /isomalt/i, /zuckeralkohol/i] },
  { id: 'caffeine', patterns: [/kaffee/i, /coffee/i, /espresso/i, /cappuccino/i, /latte/i, /cola/i, /energy drink/i, /koffein/i, /caffeine/i, /schwarztee/i, /grüntee/i] },
  { id: 'alcohol', patterns: [/alkohol/i, /wein/i, /bier/i, /sekt/i, /cocktail/i, /gin/i, /vodka/i, /rum/i, /whisky/i, /whiskey/i] },
  { id: 'spicy', patterns: [/chili/i, /scharf/i, /cayenne/i, /jalape/i, /sriracha/i, /harissa/i] },
  { id: 'high-fat', patterns: [/frittiert/i, /fried/i, /sahne/i, /mayonnaise/i, /pommes/i, /chips/i, /speck/i, /salami/i, /butter/i] },
];

export function inferFoodGroups(food: Pick<FoodItem, 'name' | 'brand' | 'ingredients' | 'allergens' | 'nutritionPer100g' | 'groups'>): FoodGroupId[] {
  const explicit = Array.isArray(food.groups) ? food.groups : [];
  const haystack = [food.name, food.brand, food.ingredients, ...(food.allergens || [])].filter(Boolean).join(' · ');
  const groups = new Set<FoodGroupId>(explicit);
  for (const matcher of MATCHERS) if (matcher.patterns.some(pattern => pattern.test(haystack))) groups.add(matcher.id);
  if ((food.nutritionPer100g?.fat ?? 0) >= 20) groups.add('high-fat');
  return [...groups];
}

export function enrichFoodGroups<T extends FoodItem>(food: T): T {
  return { ...food, groups: inferFoodGroups(food) };
}
