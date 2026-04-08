export type ChatRequestChoice = "availability" | "reserve" | "question";

export type ChatRequestContext = {
  price?: string | null;
  product?: string | null;
  variant?: string | null;
};

function formatPriceLabel(price?: string | null) {
  if (!price) {
    return "";
  }

  const parsed = Number(price);

  if (Number.isFinite(parsed) && parsed > 0) {
    return `₦${parsed.toLocaleString("en-NG")}`;
  }

  return price.startsWith("₦") ? price : `₦${price}`;
}

function buildProductContext({ product, variant }: ChatRequestContext) {
  const productName = product?.trim() || "";
  const variantName = variant?.trim() || "";

  if (productName && variantName) {
    return `${productName} (${variantName})`;
  }

  if (productName) {
    return productName;
  }

  if (variantName) {
    return variantName;
  }

  return "";
}

export function buildChatRequestMessage(
  choice: ChatRequestChoice,
  context: ChatRequestContext = {},
) {
  const priceLabel = formatPriceLabel(context.price);
  const productContext = buildProductContext(context);

  if (choice === "availability") {
    if (productContext && priceLabel) {
      return `Hi, is ${productContext} still available at ${priceLabel}?`;
    }

    if (productContext) {
      return `Hi, is ${productContext} still available?`;
    }

    return "Hi, is this product still available?";
  }

  if (choice === "reserve") {
    if (productContext) {
      return `Hi, can you reserve ${productContext} for me? I'll be there soon.`;
    }

    return "Hi, can you reserve this product for me? I'll be there soon.";
  }

  if (productContext) {
    return `Hi, I have a question about ${productContext}.`;
  }

  return "Hi, I have a question about this product.";
}
