import React, { useState } from "react";
import debug from "../../utils/debug";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string; // unencoded raw slug (e.g. "Makina-san's_a_Love_Bot?!")
  fallbackSrc?: string;
  path?: string
}

export const SafeImage: React.FC<SafeImageProps> = ({
                                                      src,
                                                      fallbackSrc = "/assets/not found.jpg",
                                                      onError,
                                                      ...imgProps
                                                    }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
 const path = imgProps.path ? imgProps.path+"/" : "";
 // replace src %20 with +
  const encodedSrc = src.replace(/%20/g, "+");
  //debug.info("image url passed:", encodedSrc);
  return (
    <img
      {...imgProps}
      src={`${global.config.cdn_url}/${path}${encodeURIComponent(encodedSrc)}`}
      data-original-src={`${global.config.cdn_url}/${path}${encodeURIComponent(encodedSrc)}`}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = fallbackSrc;
        onError?.(e); // call original onError if provided
      }}
    />
  );
};
