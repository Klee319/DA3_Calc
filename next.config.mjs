/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静的エクスポート設定
  output: 'export',
  // GitHub Pages用のベースパス設定
  basePath: '/DA3_Calc_DP',
  assetPrefix: '/DA3_Calc_DP/',
  // 本番ビルドでSource Mapを無効化（DevToolsでのソースコード表示を抑制）
  productionBrowserSourceMaps: false,
};
export default nextConfig;
