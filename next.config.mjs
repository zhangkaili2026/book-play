/** @type {import('next').NextConfig} */
const nextConfig = {
  // 纯客户端应用：构建时生成静态 HTML，可部署到 Vercel / GitHub Pages / Netlify。
  output: "export",
  // 静态导出必须禁用 next/image 的图片优化
  images: { unoptimized: true },
  // GitHub Pages 部署在子路径（用户名.github.io/仓库名/）下，需要 basePath；
  // 由 GitHub Actions 工作流设置 GITHUB_PAGES=true 时自动启用，Vercel 不受影响。
  ...(process.env.GITHUB_PAGES === "true"
    ? { basePath: "/book-play", trailingSlash: true }
    : {}),
};

export default nextConfig;
