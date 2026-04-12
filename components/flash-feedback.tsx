import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";
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
    backgroundColor: "rgba(14, 24, 45, 0.96)",
    borderColor: "rgba(96,143,255,0.28)",
  },
  errorCard: {
    backgroundColor: "rgba(17, 24, 39, 0.96)",
    borderColor: theme.colors.borderStrong,
  },
  text: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
