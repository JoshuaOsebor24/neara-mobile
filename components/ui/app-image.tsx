import {
  Image as ExpoImage,
  ImageBackground as ExpoImageBackground,
  type ImageBackgroundProps as ExpoImageBackgroundProps,
  type ImageProps as ExpoImageProps,
} from "expo-image";
import { memo, useEffect, useMemo, useState } from "react";
import { View } from "react-native";

const DEFAULT_PLACEHOLDER_HASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

function normalizeImageUri(uri?: string | null) {
  const normalized = String(uri || "").trim();
  return normalized || null;
}

function isCacheableRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function buildImageSource(uri?: string | null) {
  const normalizedUri = normalizeImageUri(uri);

  if (!normalizedUri) {
    return null;
  }

  if (isCacheableRemoteUri(normalizedUri)) {
    return {
      cacheKey: normalizedUri,
      uri: normalizedUri,
    };
  }

  return normalizedUri;
}

type AppImageProps = Omit<ExpoImageProps, "placeholder" | "source"> & {
  fallbackBackgroundColor?: string;
  fallbackSource?: number;
  placeholder?: ExpoImageProps["placeholder"];
  uri?: string | null;
};

function AppImageComponent({
  cachePolicy,
  contentFit = "cover",
  fallbackBackgroundColor = "rgba(255,255,255,0.05)",
  fallbackSource,
  onError,
  placeholder,
  placeholderContentFit,
  transition,
  uri,
  ...props
}: AppImageProps) {
  const normalizedUri = normalizeImageUri(uri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [normalizedUri]);

  const source = useMemo(() => {
    if (hasError) {
      return fallbackSource ?? null;
    }

    return buildImageSource(normalizedUri) ?? fallbackSource ?? null;
  }, [fallbackSource, hasError, normalizedUri]);

  if (!source) {
    return (
      <View style={[props.style, { backgroundColor: fallbackBackgroundColor }]} />
    );
  }

  return (
    <ExpoImage
      {...props}
      cachePolicy={cachePolicy ?? "memory-disk"}
      contentFit={contentFit}
      onError={(event) => {
        setHasError(true);
        onError?.(event);
      }}
      placeholder={placeholder ?? DEFAULT_PLACEHOLDER_HASH}
      placeholderContentFit={placeholderContentFit ?? contentFit}
      recyclingKey={props.recyclingKey ?? normalizedUri}
      source={source}
      transition={transition ?? 120}
    />
  );
}

type AppImageBackgroundProps = Omit<
  ExpoImageBackgroundProps,
  "placeholder" | "source"
> & {
  fallbackBackgroundColor?: string;
  placeholder?: ExpoImageBackgroundProps["placeholder"];
  uri?: string | null;
};

function AppImageBackgroundComponent({
  cachePolicy,
  children,
  contentFit = "cover",
  fallbackBackgroundColor = "rgba(255,255,255,0.04)",
  onError,
  placeholder,
  placeholderContentFit,
  style,
  transition,
  uri,
  ...props
}: AppImageBackgroundProps) {
  const normalizedUri = normalizeImageUri(uri);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [normalizedUri]);

  const source = useMemo(() => {
    if (hasError) {
      return null;
    }

    return buildImageSource(normalizedUri);
  }, [hasError, normalizedUri]);

  if (!source) {
    return (
      <View style={[style, { backgroundColor: fallbackBackgroundColor }]}>
        {children}
      </View>
    );
  }

  return (
    <ExpoImageBackground
      {...props}
      cachePolicy={cachePolicy ?? "memory-disk"}
      contentFit={contentFit}
      onError={(event) => {
        setHasError(true);
        onError?.(event);
      }}
      placeholder={placeholder ?? DEFAULT_PLACEHOLDER_HASH}
      placeholderContentFit={placeholderContentFit ?? contentFit}
      recyclingKey={props.recyclingKey ?? normalizedUri}
      source={source}
      style={style}
      transition={transition ?? 120}
    >
      {children}
    </ExpoImageBackground>
  );
}

export const AppImage = memo(AppImageComponent);
export const AppImageBackground = memo(AppImageBackgroundComponent);

export { normalizeImageUri, isCacheableRemoteUri };
