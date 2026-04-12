import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

export type StoreCoordinates = {
  latitude: number;
  longitude: number;
};

export function StoreLocationPicker({
  address,
  coordinates,
  storeName,
}: {
  address: string;
  coordinates: StoreCoordinates | null;
  onChange: (coordinates: StoreCoordinates) => void;
  storeName: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.titleRow}>
          <Ionicons color="#4A88FF" name="map-outline" size={18} />
          <Text style={styles.overlayTitle}>Map editing is mobile-only</Text>
        </View>
        <Text style={styles.overlayText}>
          Open this flow on iOS or Android to place or move the store pin.
        </Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Store</Text>
          <Text style={styles.infoValue}>{storeName || "Unnamed store"}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Address</Text>
          <Text style={styles.infoValue}>
            {address || "No address added yet"}
          </Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Saved coordinates</Text>
          <Text style={styles.infoValue}>
            {coordinates
              ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
              : "No pin selected yet"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(10,15,31,0.96)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 320,
    overflow: "hidden",
    padding: 16,
  },
  overlay: {
    backgroundColor: "rgba(10,15,31,0.86)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  overlayTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  overlayText: {
    color: "#d3dfed",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: "rgba(17,24,39,0.84)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  infoLabel: {
    color: "#B8C2D9",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginTop: 6,
  },
});
