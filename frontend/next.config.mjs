/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bootstrap 5.3 utilise encore des API Sass dépréciées : on masque ces avertissements de build (sans effet sur le rendu).
  sassOptions: { quietDeps: true, silenceDeprecations: ["import", "global-builtin", "color-functions", "mixed-decls"] },
};

export default nextConfig;
