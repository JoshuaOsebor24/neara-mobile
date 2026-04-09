import { normalizeCommaSeparatedValues } from "@/constants/product-taxonomy";

export const PRODUCT_IMPORT_TEMPLATE = `product_name,variant_name,price,unit_count,stock,description,category,tags
Indomie,Pack,3500,12,20,,Grocery,"noodles,food"
Indomie,Single,300,1,50,,Grocery,"noodles,food"
Fanta,35cl Bottle,300,1,30,,Drinks,"orange,soft drink"
Fanta,50cl Bottle,400,1,20,,Drinks,"orange,soft drink"`;

export type ProductImportRowError = {
  message: string;
  row: number;
};

export type ProductImportVariantPreview = {
  price: number;
  stock: number | null;
  unitCount: number;
  variantName: string;
};

export type ProductImportProductPreview = {
  category: string | null;
  description: string | null;
  productName: string;
  rowNumbers: number[];
  tags: string[];
  variants: ProductImportVariantPreview[];
};

export type ParsedProductImport = {
  errors: ProductImportRowError[];
  groups: ProductImportProductPreview[];
  totalRows: number;
};

const REQUIRED_HEADERS = ["product_name", "variant_name", "price"] as const;

function normalizeCell(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      currentRow.push(currentField);
      const hasContent = currentRow.some((cell) => cell.length > 0);

      if (hasContent) {
        rows.push(currentRow);
      }

      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += character;
  }

  currentRow.push(currentField);
  const hasTrailingContent = currentRow.some((cell) => cell.length > 0);

  if (hasTrailingContent) {
    rows.push(currentRow);
  }

  return rows;
}

function parsePositiveNumber(value: string) {
  const normalized = normalizeCell(value);

  if (!normalized) {
    return null;
  }

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function parsePositiveInteger(value: string, fallback?: number | null) {
  const normalized = normalizeCell(value);

  if (!normalized) {
    return fallback ?? null;
  }

  const numericValue = Number.parseInt(normalized, 10);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

export function formatUnitCountLabel(unitCount?: number | null) {
  const normalized =
    typeof unitCount === "number" && Number.isFinite(unitCount) && unitCount > 0
      ? unitCount
      : 1;

  return normalized > 1 ? `Pack of ${normalized}` : "Single";
}

export function parseProductImportCsv(csvText: string): ParsedProductImport {
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    return {
      errors: [
        {
          message: "The CSV file is empty.",
          row: 1,
        },
      ],
      groups: [],
      totalRows: 0,
    };
  }

  const headerRow = rows[0].map((value) => normalizeCell(value).toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headerRow.includes(header),
  );

  if (missingHeaders.length > 0) {
    return {
      errors: [
        {
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
          row: 1,
        },
      ],
      groups: [],
      totalRows: Math.max(0, rows.length - 1),
    };
  }

  const headerIndex = new Map(headerRow.map((header, index) => [header, index]));
  const errors: ProductImportRowError[] = [];
  const groupedProducts = new Map<string, ProductImportProductPreview>();

  rows.slice(1).forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const getValue = (key: string) =>
      normalizeCell(row[headerIndex.get(key) ?? -1] ?? "");

    const productName = getValue("product_name");
    const variantName = getValue("variant_name");
    const rawPrice = getValue("price");
    const rawUnitCount = getValue("unit_count");
    const rawStock = getValue("stock");
    const description = getValue("description") || null;
    const category = getValue("category") || null;
    const tags = normalizeCommaSeparatedValues(getValue("tags"));

    if (!productName && !variantName && !rawPrice && !rawUnitCount && !rawStock) {
      return;
    }

    const price = parsePositiveNumber(rawPrice);
    const unitCount = parsePositiveInteger(rawUnitCount, 1);
    const stock = parsePositiveInteger(rawStock, null);

    if (!productName) {
      errors.push({ message: "missing product_name", row: rowNumber });
      return;
    }

    if (!variantName) {
      errors.push({ message: "missing variant_name", row: rowNumber });
      return;
    }

    if (price === null) {
      errors.push({ message: "invalid price", row: rowNumber });
      return;
    }

    if (unitCount === null || unitCount <= 0) {
      errors.push({ message: "invalid unit_count", row: rowNumber });
      return;
    }

    if (rawStock && stock === null) {
      errors.push({ message: "invalid stock", row: rowNumber });
      return;
    }

    const groupKey = productName.toLowerCase();
    const existingGroup = groupedProducts.get(groupKey);

    if (!existingGroup) {
      groupedProducts.set(groupKey, {
        category,
        description,
        productName,
        rowNumbers: [rowNumber],
        tags,
        variants: [
          {
            price,
            stock,
            unitCount,
            variantName,
          },
        ],
      });
      return;
    }

    if (
      category &&
      existingGroup.category &&
      category.toLowerCase() !== existingGroup.category.toLowerCase()
    ) {
      errors.push({
        message: `category conflicts with earlier rows for ${productName}`,
        row: rowNumber,
      });
      return;
    }

    if (
      description &&
      existingGroup.description &&
      description !== existingGroup.description
    ) {
      errors.push({
        message: `description conflicts with earlier rows for ${productName}`,
        row: rowNumber,
      });
      return;
    }

    existingGroup.category = existingGroup.category || category;
    existingGroup.description = existingGroup.description || description;
    existingGroup.tags = Array.from(new Set([...existingGroup.tags, ...tags]));
    existingGroup.rowNumbers.push(rowNumber);
    existingGroup.variants.push({
      price,
      stock,
      unitCount,
      variantName,
    });
  });

  return {
    errors,
    groups: Array.from(groupedProducts.values()),
    totalRows: Math.max(0, rows.length - 1),
  };
}
