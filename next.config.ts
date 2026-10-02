import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 silently coerces any `quality` prop not listed here to the
    // nearest allowed value. Add every quality you use.
    qualities: [75],
  },
};

export default nextConfig;
