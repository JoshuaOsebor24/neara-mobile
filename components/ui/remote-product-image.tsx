import { memo, type ComponentProps } from "react";

import { AppImage } from "@/components/ui/app-image";

const PRODUCT_PLACEHOLDER = require("../../assets/images/product-placeholder.png");

type RemoteProductImageProps = Omit<ComponentProps<typeof AppImage>, "fallbackSource" | "uri"> & {
  uri?: string | null;
};

function RemoteProductImageComponent({
  contentFit = "cover",
  uri,
  ...props
}: RemoteProductImageProps) {
  return (
    <AppImage
      {...props}
      contentFit={contentFit}
      fallbackSource={PRODUCT_PLACEHOLDER}
      placeholder={PRODUCT_PLACEHOLDER}
      uri={uri}
    />
  );
}

export const RemoteProductImage = memo(RemoteProductImageComponent);
