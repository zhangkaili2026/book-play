/** @type {import('next').NextConfig} */
const nextConfig = {
  // 纯客户端应用：构建时生成静态 HTML，可部署到 Vercel / GitHub Pages / Netlify。
  output: "export",
  // 静态导出必须禁用 next/image 的图片优化
  images: { unoptimized: true },
  // 部署到 GitHub Pages 项目页（https://用户名.github.io/仓库名/）时，取消下面两行注释：
  // basePath: "/仓库名",
  // trailingSlash: true,
};

export default nextConfig;
