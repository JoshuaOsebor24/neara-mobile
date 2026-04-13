import { Image } from "expo-image";

import { isCacheableRemoteUri, normalizeImageUri } from "@/components/ui/app-image";

export function getUniqueImageUris(urls: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      urls
        .map((value) => normalizeImageUri(value))
        .filter((value): value is string => Boolean(value && isCacheableRemoteUri(value))),
    ),
  );
}

export async function prefetchImageUris(urls: (string | null | undefined)[]) {
  const uniqueUris = getUniqueImageUris(urls);

  if (uniqueUris.length === 0) {
    return;
  }

  try {
    await Image.prefetch(uniqueUris, "memory-disk");
  } catch {
    // Rendering should continue even if prefetching fails.
  }
}
