import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
  },
  async redirects() {
    return [
      // TASK 13 路由改名 /customer-orders → /orders，旧链接 308 永久跳转
      { source: "/customer-orders", destination: "/orders", permanent: true },
      { source: "/customer-orders/:path*", destination: "/orders/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
