import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";

import { theme } from "@/constants/theme";
import { DEFAULT_MAP_COORDINATES } from "@/services/location";

export type StoreCoordinates = {
  latitude: number;
  longitude: number;
};

function buildRegion(coordinates: StoreCoordinates | null): Region {
  return {
    latitude: coordinates?.latitude ?? DEFAULT_MAP_COORDINATES.latitude,
    latitudeDelta: coordinates ? 0.008 : 0.016,
    longitude: coordinates?.longitude ?? DEFAULT_MAP_COORDINATES.longitude,
    longitudeDelta: coordinates ? 0.008 : 0.016,
  };
}

export function StoreLocationPicker({
  address,
  coordinates,
  onChange,
  storeName,
}: {
  address: string;
  coordinates: StoreCoordinates | null;
  onChange: (coordinates: StoreCoordinates) => void;
  storeName: string;
}) {
  const region = useMemo(() => buildRegion(coordinates), [coordinates]);
  const [displayRegion, setDisplayRegion] = useState<Region>(region);

  useEffect(() => {
    setDisplayRegion(region);
  }, [region]);

  const handleMapPress = (event: MapPressEvent) => {
    const nextCoordinates = {
      latitude: event.nativeEvent.coordinate.latitude,
      longitude: event.nativeEvent.coordinate.longitude,
    };
    onChange(nextCoordinates);
  };

  return (
    <View style={styles.container}>
      <MapView
        initialRegion={region}
        mapType="standard"
        onRegionChangeComplete={setDisplayRegion}
        onPress={handleMapPress}
        region={displayRegion}
        style={styles.map}
      >
        {coordinates ? (
          <Marker
            coordinate={coordinates}
            draggable
            onDragEnd={(event) => onChange(event.nativeEvent.coordinate)}
          />
        ) : null}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.overlayTitle}>
          {coordinates ? "Pin ready" : "Place your pin"}
        </Text>
        <Text style={styles.overlayText}>
          {coordinates
            ? address || storeName || "Tap to move the pin and fine-tune the store location."
            : "Tap to place the pin. The pin is the final saved store location."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 24,
    borderWidth: 1,
    height: 320,
    overflow: "hidden",
  },
  map: {
    height: "100%",
    width: "100%",
  },
  overlay: {
    left: 16,
    position: "absolute",
    right: 16,
    top: 16,
    backgroundColor: "rgba(10,15,31,0.86)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    marginTop: 6,
  },
});
