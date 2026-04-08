export type PlaceCoordinates = {
  latitude: number;
  longitude: number;
};

export type PlaceSuggestion = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  coordinates: PlaceCoordinates | null;
  placeName: string;
};

type MapboxFeature = {
  id?: string;
  place_name?: string;
  center?: [number, number];
  geometry?: {
    coordinates?: [number, number];
  };
};

type MapboxGeocodingResponse = {
  error?: string;
  features?: MapboxFeature[];
  message?: string;
};

class PlaceAutocompleteError extends Error {
  body: unknown;
  status: number;
  statusText: string;
  url: string;

  constructor(
    message: string,
    details: {
      body: unknown;
      status: number;
      statusText: string;
      url: string;
    },
  ) {
    super(message);
    this.name = "PlaceAutocompleteError";
    this.body = details.body;
    this.status = details.status;
    this.statusText = details.statusText;
    this.url = details.url;
  }
}

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN?.trim() || "";

function normalizeCoordinates(
  coordinates:
    | {
        latitude?: number | null;
        longitude?: number | null;
      }
    | null
    | undefined,
) {
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  } satisfies PlaceCoordinates;
}

function getCoordinatesFromFeature(feature: MapboxFeature) {
  const [longitude, latitude] = feature.center || feature.geometry?.coordinates || [];

  return normalizeCoordinates({
    latitude,
    longitude,
  });
}

function getErrorMessage(body: unknown, statusText: string, fallbackMessage: string) {
  if (body && typeof body === "object") {
    if ("message" in body && typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }

    if ("error" in body && typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  }

  if (typeof body === "string" && body.trim()) {
    return body;
  }

  return statusText || fallbackMessage;
}

async function parseBody(response: Response) {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as MapboxGeocodingResponse;
  } catch {
    return rawBody;
  }
}

async function requestMapbox(url: string, fallbackMessage: string) {
  const response = await fetch(url);
  const body = await parseBody(response);

  if (!response.ok) {
    throw new PlaceAutocompleteError(
      getErrorMessage(body, response.statusText, fallbackMessage),
      {
        body,
        status: response.status,
        statusText: response.statusText,
        url,
      },
    );
  }

  if (!body || typeof body !== "object") {
    throw new Error("Place search returned an unreadable response.");
  }

  return body as MapboxGeocodingResponse;
}

function buildAutocompleteUrl(query: string, proximity?: PlaceCoordinates | null) {
  const baseUrl =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_ACCESS_TOKEN}&autocomplete=true&limit=5&country=ng`;

  if (!proximity) {
    return baseUrl;
  }

  return `${baseUrl}&proximity=${proximity.longitude},${proximity.latitude}`;
}

function buildGeocodeUrl(query: string, proximity?: PlaceCoordinates | null) {
  const baseUrl =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_ACCESS_TOKEN}&autocomplete=false&limit=1&country=ng`;

  if (!proximity) {
    return baseUrl;
  }

  return `${baseUrl}&proximity=${proximity.longitude},${proximity.latitude}`;
}

function toSuggestion(feature: MapboxFeature) {
  const placeName = feature.place_name?.trim();

  if (!placeName) {
    return null;
  }

  const [title, ...rest] = placeName.split(",").map((part) => part.trim());

  return {
    coordinates: getCoordinatesFromFeature(feature),
    id: feature.id || placeName,
    label: placeName,
    placeName,
    subtitle: rest.join(", "),
    title: title || placeName,
  } satisfies PlaceSuggestion;
}

export function hasPlaceAutocompleteToken() {
  return Boolean(MAPBOX_ACCESS_TOKEN);
}

export function getPlaceAutocompleteErrorDetails(error: unknown) {
  if (error instanceof PlaceAutocompleteError) {
    return {
      body: error.body,
      status: error.status,
      statusText: error.statusText,
      url: error.url,
    };
  }

  return null;
}

export async function fetchPlaceSuggestions(options: {
  proximity?: PlaceCoordinates | null;
  query: string;
}) {
  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error("Place search is unavailable right now.");
  }

  const url = buildAutocompleteUrl(options.query, options.proximity);
  const response = await requestMapbox(url, "Place autocomplete request failed.");

  return (response.features || [])
    .map(toSuggestion)
    .filter((suggestion): suggestion is PlaceSuggestion => Boolean(suggestion))
    .slice(0, 5);
}

export async function geocodePlace(options: {
  proximity?: PlaceCoordinates | null;
  query: string;
}) {
  if (!MAPBOX_ACCESS_TOKEN) {
    throw new Error("Place search is unavailable right now.");
  }

  const url = buildGeocodeUrl(options.query, options.proximity);
  const response = await requestMapbox(url, "Place geocoding request failed.");
  const match = response.features?.[0];
  const coordinates = match ? getCoordinatesFromFeature(match) : null;

  if (!match?.place_name || !coordinates) {
    return null;
  }

  return {
    coordinates,
    formattedAddress: match.place_name,
    url,
  };
}
