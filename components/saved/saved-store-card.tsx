import { memo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { AppImage } from "@/components/ui/app-image";
import { theme } from "@/constants/theme";
import type { SavedStoreRecord } from "@/services/saved-stores";

function formatStoreArea(address?: string | null) {
  if (!address) {
    return "No area";
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return parts[parts.length - 2];
  }

  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }

  return parts[0] || "No area";
}

function buildInitialLabel(value: string, fallback = "S") {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : fallback;
}

function SavedStoreCardComponent({
  isRemoving,
  onOpen,
  onUnsave,
  store,
}: {
  isRemoving: boolean;
  onOpen: () => void;
  onUnsave: () => void;
  store: SavedStoreRecord;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onOpen}
        style={styles.linkRow}
      >
        <View style={styles.imageWrap}>
          {store.image_url ? (
            <AppImage
              contentFit="cover"
              style={styles.storeImage}
              uri={store.image_url}
            />
          ) : (
            <View style={styles.storeImageFallback}>
              <Text style={styles.storeImageFallbackText}>
                {buildInitialLabel(store.store_name)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.contentWrap}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.storeName}>
              {store.store_name}
            </Text>
          </View>

          <Text numberOfLines={1} style={styles.categoryText}>
            {store.category || "Store"}
          </Text>
          <Text numberOfLines={1} style={styles.locationText}>
            {formatStoreArea(store.address)}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={isRemoving}
        onPress={onUnsave}
        style={[styles.savedButton, isRemoving && styles.savedButtonDisabled]}
      >
        <Text style={styles.savedButtonText}>
          {isRemoving ? "Removing" : "Remove"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const SavedStoreCard = memo(SavedStoreCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  linkRow: {
    flexDirection: "row",
    gap: 14,
  },
  imageWrap: {
    alignSelf: "flex-start",
    backgroundColor: "#111827",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    borderWidth: 1,
    height: 72,
    overflow: "hidden",
    width: 72,
  },
  storeImage: {
    height: "100%",
    width: "100%",
  },
  storeImageFallback: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.24)",
    flex: 1,
    justifyContent: "center",
  },
  storeImageFallbackText: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  contentWrap: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  storeName: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  categoryText: {
    color: "#C7D2E5",
    fontSize: 13,
    marginTop: 6,
  },
  locationText: {
    color: "#B8C2D9",
    fontSize: 13,
    marginTop: 4,
  },
  savedButton: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: theme.colors.borderSoft,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  savedButtonDisabled: {
    opacity: 0.7,
  },
  savedButtonText: {
    color: theme.colors.subduedText,
    fontSize: 13,
    fontWeight: "700",
  },
});
