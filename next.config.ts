import createNextIntlPlugin from "next-intl/plugin";
import { webpack } from "next/dist/compiled/webpack/webpack";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    proxyClientMaxBodySize: 1024 * 1024 * 100,
    middlewareClientMaxBodySize: 1024 * 1024 * 100,
    serverActions: {
      bodySizeLimit: 1024 * 1024 * 100, // 100MB
      proxyClientMaxBodySize: 1024 * 1024 * 100,
    },
  },
};

export default withNextIntl(nextConfig);
