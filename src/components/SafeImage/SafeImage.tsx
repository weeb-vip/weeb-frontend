import React, { useEffect, useState } from "react";
import axios from "axios";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string; // unencoded raw slug (e.g. "Makina-san's_a_Love_Bot?!")
  fallbackSrc?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
                                                      src,
                                                      fallbackSrc = "/assets/not found.jpg",
                                                      onError,
                                                      ...imgProps
                                                    }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  return (
    <img
      {...imgProps}
      src={`https://cdn.weeb.vip/weeb/${encodeURIComponent(src)}`}
      data-original-src={`https://cdn.weeb.vip/weeb/${src}`}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = fallbackSrc;
        onError?.(e); // call original onError if provided
      }}
    />
  );
};
