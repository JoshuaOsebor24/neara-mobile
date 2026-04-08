export function parseCoordinate(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

export function buildDirectionsUrl(input: {
  label?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
}) {
  const latitude = parseCoordinate(input.latitude);
  const longitude = parseCoordinate(input.longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  const label = encodeURIComponent(input.label?.trim() || "Store");
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place=${label}&travelmode=driving`;
}
