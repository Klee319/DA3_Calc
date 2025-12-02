/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番ビルドでSource Mapを無効化（DevToolsでのソースコード表示を抑制）
  productionBrowserSourceMaps: false,
};
export default nextConfig;
