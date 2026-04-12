import { useEffect, useMemo, useState } from "react";
import {
  Image,
  type ImageErrorEventData,
  type ImageProps,
  type NativeSyntheticEvent,
} from "react-native";

const PRODUCT_PLACEHOLDER = require("../../assets/images/product-placeholder.png");

type RemoteProductImageProps = Omit<ImageProps, "source"> & {
  uri?: string | null;
};

export function RemoteProductImage({
  onError,
  uri,
  ...props
}: RemoteProductImageProps) {
  const normalizedUri = uri?.trim() || "";
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [normalizedUri]);

  const source = useMemo(() => {
    if (!normalizedUri || hasError) {
      return PRODUCT_PLACEHOLDER;
    }

    return { uri: normalizedUri };
  }, [hasError, normalizedUri]);

  const handleError = (
    event: NativeSyntheticEvent<ImageErrorEventData>,
  ) => {
    setHasError(true);
    onError?.(event);
  };

  return <Image {...props} onError={handleError} source={source} />;
}
