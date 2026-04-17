import { usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { theme } from "@/constants/theme";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/stores", label: "Manage Stores" },
  { href: "/admin/users", label: "Manage Users" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      {ADMIN_NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);

        return (
          <TouchableOpacity
            activeOpacity={0.85}
            key={item.href}
            onPress={() => router.push(item.href)}
            style={[styles.item, active ? styles.itemActive : null]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  item: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: "rgba(74,136,255,0.18)",
    borderColor: "rgba(138,182,255,0.38)",
  },
  label: {
    color: theme.colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
  },
  labelActive: {
    color: theme.colors.text,
  },
});
