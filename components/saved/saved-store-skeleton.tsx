import { StyleSheet, View } from "react-native";

export function SavedStoreSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.leftRail}>
          <View style={styles.image} />
          <View style={styles.savedButton} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.title} />
            <View style={styles.badge} />
          </View>
          <View style={styles.lineMedium} />
          <View style={styles.lineSmall} />
        </View>
      </View>
    </View>
  );
}

const SHIMMER = "rgba(255,255,255,0.06)";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  row: {
    flexDirection: "row",
    gap: 18,
  },
  leftRail: {
    width: 112,
  },
  image: {
    backgroundColor: SHIMMER,
    borderRadius: 22,
    height: 96,
    width: 96,
  },
  savedButton: {
    backgroundColor: SHIMMER,
    borderRadius: 20,
    height: 48,
    marginTop: 18,
    width: 110,
  },
  content: {
    flex: 1,
    paddingTop: 6,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  title: {
    backgroundColor: SHIMMER,
    borderRadius: 10,
    height: 28,
    width: "52%",
  },
  badge: {
    backgroundColor: SHIMMER,
    borderRadius: 999,
    height: 32,
    width: 118,
  },
  lineMedium: {
    backgroundColor: SHIMMER,
    borderRadius: 10,
    height: 22,
    marginBottom: 10,
    width: "44%",
  },
  lineSmall: {
    backgroundColor: SHIMMER,
    borderRadius: 10,
    height: 22,
    width: "38%",
  },
});
