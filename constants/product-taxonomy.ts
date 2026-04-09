export const MAIN_CATEGORY_OPTIONS = [
  "Custom",
  "Grocery",
  "Drinks",
  "Snacks",
  "Electronics",
  "Produce",
  "Bakery",
  "Dairy",
  "Accessories",
  "Beauty",
] as const;

export const TAG_OPTIONS = [
  "orange",
  "juice",
  "soft drink",
  "cold",
  "soda",
  "wireless",
  "charger",
  "fresh",
  "drink",
  "snack",
  "bread",
  "rice",
  "fruit",
  "vegetable",
  "phone accessory",
  "toiletries",
  "cleaning",
  "beauty",
] as const;

export function normalizeCommaSeparatedValues(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
