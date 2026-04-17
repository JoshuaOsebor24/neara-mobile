import { memo, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { RemoteProductImage } from "@/components/ui/remote-product-image";
import { theme } from "@/constants/theme";

export type SearchResultCardVariant = {
  key: string;
  label: string | null;
  value?: string;
};

type SearchResultCardProps = {
  actionLabel?: string;
  animationIndex?: number;
  animationTriggerKey?: string;
  category?: string;
  distance?: string;
  image?: string | null;
  onPress: () => void;
  primaryText: string;
  secondaryText?: string;
  style?: StyleProp<ViewStyle>;
  variants: SearchResultCardVariant[];
};

function SearchResultCardComponent({
  actionLabel,
  animationIndex = 0,
  animationTriggerKey,
  category,
  distance,
  image,
  onPress,
  primaryText,
  secondaryText,
  style,
  variants,
}: SearchResultCardProps) {
  const entranceOpacity = useRef(
    new Animated.Value(animationTriggerKey ? 0 : 1),
  ).current;
  const entranceTranslateX = useRef(
    new Animated.Value(animationTriggerKey ? 26 : 0),
  ).current;
  const hasSecondaryText = Boolean(secondaryText?.trim());
  const visibleVariants = variants.length
    ? variants
    : [
        {
          key: "store-preview",
          label: "Open store",
        },
      ];

  useEffect(() => {
    if (!animationTriggerKey) {
      entranceOpacity.setValue(1);
      entranceTranslateX.setValue(0);
      return;
    }

    const delay = Math.min(animationIndex, 7) * 60;

    entranceOpacity.setValue(0);
    entranceTranslateX.setValue(26);

    const animation = Animated.parallel([
      Animated.timing(entranceOpacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(entranceTranslateX, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    animationIndex,
    animationTriggerKey,
    entranceOpacity,
    entranceTranslateX,
  ]);

  return (
    <Animated.View
      style={{
        opacity: entranceOpacity,
        transform: [{ translateX: entranceTranslateX }],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          style,
          pressed ? styles.cardPressed : null,
        ]}
      >
        <View style={styles.inner}>
          <RemoteProductImage style={styles.image} uri={image} />

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={styles.textColumn}>
                <Text numberOfLines={1} style={styles.primaryText}>
                  {primaryText}
                </Text>

                {hasSecondaryText ? (
                  <Text numberOfLines={2} style={styles.secondaryText}>
                    {secondaryText}
                  </Text>
                ) : null}

                {category ? (
                  <Text numberOfLines={1} style={styles.categoryText}>
                    {category}
                  </Text>
                ) : null}
              </View>

              <View style={styles.metaColumn}>
                <Text numberOfLines={1} style={styles.distanceText}>
                  {distance || ""}
                </Text>
                {actionLabel ? (
                  <Text numberOfLines={1} style={styles.actionText}>
                    {actionLabel}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.variantStack}>
              {visibleVariants.map((variant) => (
                <View key={variant.key} style={styles.variantRow}>
                  <Text numberOfLines={1} style={styles.variantLabel}>
                    {variant.label || "Available in store"}
                  </Text>
                  <Text numberOfLines={1} style={styles.variantValue}>
                    {variant.value || ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const SearchResultCard = memo(SearchResultCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceCard,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardPressed: {
    borderColor: "rgba(120,163,255,0.30)",
  },
  inner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  textColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingTop: 1,
  },
  primaryText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
  secondaryText: {
    color: "#E8EEF8",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  categoryText: {
    color: theme.colors.mutedText,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  metaColumn: {
    width: 60,
    minHeight: 50,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 1,
  },
  distanceText: {
    color: theme.colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "right",
  },
  actionText: {
    color: theme.colors.accentStrong,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "right",
    textTransform: "uppercase",
  },
  variantStack: {
    gap: 5,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  variantLabel: {
    flex: 1,
    minWidth: 0,
    color: "#B8C2D9",
    fontSize: 12,
    lineHeight: 17,
  },
  variantValue: {
    width: 68,
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "right",
  },
});
