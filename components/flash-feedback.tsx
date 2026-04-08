import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { clearFlashFeedback, useFlashFeedback } from "@/services/flash-feedback";

export function FlashFeedback() {
  const feedback = useFlashFeedback();

  useEffect(() => {
    return () => {
      clearFlashFeedback();
    };
  }, []);

  if (!feedback) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        onPress={clearFlashFeedback}
        style={[
          styles.card,
          feedback.type === "success" ? styles.successCard : styles.errorCard,
        ]}
      >
        <Text style={styles.text}>{feedback.message}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: "center",
  },
  card: {
    minWidth: "80%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  successCard: {
    backgroundColor: "rgba(6,95,70,0.96)",
    borderColor: "rgba(110,231,183,0.30)",
  },
  errorCard: {
    backgroundColor: "rgba(127,29,29,0.96)",
    borderColor: "rgba(252,165,165,0.28)",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
