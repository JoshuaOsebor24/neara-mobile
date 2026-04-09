import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { theme } from "@/constants/theme";
import {
  DEFAULT_MAP_COORDINATES,
  type LocationPermissionState,
  type UserCoordinates,
} from "@/services/location";
import type { BackendStore } from "@/services/store-api";

function formatCoordinate(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return Number(value).toFixed(5);
}

export function NearaMapView({
  coordinates,
  errorMessage,
  onRequestLocation,
  onSelectStore,
  permissionStatus,
  selectedStoreId,
  stores,
  style,
}: {
  coordinates: UserCoordinates | null;
  disableUserLocationRecenter?: boolean;
  errorMessage: string;
  focusedCoordinates?: UserCoordinates | null;
  isLoading: boolean;
  mapRecenterKey?: number;
  disableGestures?: boolean;
  onMapMoveStart?: () => void;
  onMapMoveEnd?: () => void;
  onRequestLocation: () => void;
  onSelectStore?: (storeId: string) => void;
  permissionStatus: LocationPermissionState;
  selectedStoreId?: string | null;
  stores?: BackendStore[];
  style?: ViewStyle;
}) {
  const currentCoordinates = coordinates ?? DEFAULT_MAP_COORDINATES;
  const validStores = useMemo(
    () =>
      (stores ?? []).filter(
        (store) => store.id !== null && store.id !== undefined && store.store_name,
      ),
    [stores],
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Map preview</Text>
          <Text style={styles.title}>Map is simplified on web</Text>
        </View>
        <Pressable onPress={onRequestLocation} style={styles.locationButton}>
          <Ionicons color="#dbeafe" name="locate-outline" size={16} />
          <Text style={styles.locationButtonText}>Use my location</Text>
        </Pressable>
      </View>

      <View style={styles.coordinatesCard}>
        <Text style={styles.coordinatesLabel}>
          {permissionStatus === "granted"
            ? "Current center"
            : "Default center"}
        </Text>
        <Text style={styles.coordinatesValue}>
          {formatCoordinate(currentCoordinates.latitude)},{" "}
          {formatCoordinate(currentCoordinates.longitude)}
        </Text>
        {errorMessage ? (
          <Text style={styles.coordinatesHint}>{errorMessage}</Text>
        ) : (
          <Text style={styles.coordinatesHint}>
            Native maps are available on iOS and Android. Web shows a
            lightweight store list preview.
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.storeList}
        showsVerticalScrollIndicator={false}
      >
        {validStores.length > 0 ? (
          validStores.map((store) => {
            const isSelected =
              String(store.id) === String(selectedStoreId || "");

            return (
              <Pressable
                key={String(store.id)}
                onPress={() => onSelectStore?.(String(store.id))}
                style={[
                  styles.storeCard,
                  isSelected && styles.storeCardSelected,
                ]}
              >
                <View style={styles.storeCardTopRow}>
                  <Text numberOfLines={1} style={styles.storeName}>
                    {store.store_name}
                  </Text>
                  {isSelected ? (
                    <Ionicons
                      color="#38bdf8"
                      name="checkmark-circle"
                      size={18}
                    />
                  ) : null}
                </View>
                <Text numberOfLines={1} style={styles.storeCategory}>
                  {store.category || "Store"}
                </Text>
                {store.address ? (
                  <Text numberOfLines={2} style={styles.storeAddress}>
                    {store.address}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No stores to preview</Text>
            <Text style={styles.emptyStateText}>
              Store markers will appear here when store data is available.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export { NearaMapView as MapView };

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(8, 15, 28, 0.96)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: "rgba(59,130,246,0.14)",
    borderColor: "rgba(59,130,246,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationButtonText: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "700",
  },
  coordinatesCard: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 14,
  },
  coordinatesLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  coordinatesValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
  coordinatesHint: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  storeList: {
    gap: 10,
    paddingTop: 16,
  },
  storeCard: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  storeCardSelected: {
    borderColor: "rgba(56,189,248,0.28)",
    backgroundColor: "rgba(8, 47, 73, 0.72)",
  },
  storeCardTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  storeName: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  storeCategory: {
    color: "#93c5fd",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  storeAddress: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  emptyStateTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyStateText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
});
