import React, { useState } from "react";
import debug from "../../utils/debug";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string; // unencoded raw slug (e.g. "Makina-san's_a_Love_Bot?!")
  fallbackSrc?: string;
  path?: string
  priority?: boolean; // Add priority prop for above-the-fold images
  fetchPriority?: "high" | "low" | "auto"; // Explicitly define fetchPriority
}

export const SafeImage: React.FC<SafeImageProps> = ({
                                                      src,
                                                      fallbackSrc = "/assets/not found.jpg",
                                                      onError,
                                                      priority = false,
                                                      ...imgProps
                                                    }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
 const path = imgProps.path ? imgProps.path+"/" : "";
 // replace src %20 with +
  const encodedSrc = src.replace(/%20/g, "+");

  // Handle server-side rendering where global.config might not be available
  const cdnUrl = typeof window !== 'undefined' && global?.config?.cdn_url
    ? global.config.cdn_url
    : 'https://cdn.weeb.vip/images';

  //debug.info("image url passed:", encodedSrc);
  return (
    <img
      {...imgProps}
      src={`${cdnUrl}/${path}${encodeURIComponent(encodedSrc)}`}
      data-original-src={`${cdnUrl}/${path}${encodeURIComponent(encodedSrc)}`}
      loading={priority ? "eager" : imgProps.loading || "lazy"}
      // @ts-ignore react doesn't recognize fetchPriority yet
      fetchPriority={priority ? "high" : "auto"}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = fallbackSrc;
        onError?.(e); // call original onError if provided
      }}
    />
  );
};
