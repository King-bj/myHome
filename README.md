# 植木自生 (Zhimu Zisheng) - 个人网站

基于 [Astro](https://astro.build) 构建的双语个人网站，包含博客文章、项目展示和视频内容。

## 功能特性

- 🌐 **双语支持** - 中英文切换
- 📝 **博客系统** - Markdown 文章，支持标签、封面图
- 🚀 **项目展示** - 项目卡片，支持技术栈、GitHub、Demo 链接
- 🎬 **视频内容** - 支持 Bilibili 和 YouTube 视频
- 🖼️ **图片优化** - 自动压缩为 WebP 并上传到 Cloudflare R2
- 🔍 **搜索功能** - 文章和项目搜索
- 📱 **响应式设计** - 支持桌面和移动端

## 技术栈

- [Astro](https://astro.build) - 静态站点生成器
- [Tailwind CSS](https://tailwindcss.com) - 样式框架
- [React](https://react.dev) - UI 组件
- [TypeScript](https://www.typescriptlang.org/) - 类型支持
- [Cloudflare R2](https://www.cloudflare.com/products/r2/) - 图片存储
- [Sharp](https://sharp.pixelplumbing.com/) - 图片处理

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:4321`

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 内容管理

### 创建文章

在 `src/content/articles/` 目录下创建 `.md` 文件：

```markdown
---
title: 文章标题
titleEn: Article Title (可选)
description: 文章描述
descriptionEn: Article description (可选)
pubDate: 2024-01-01
tags: [标签1, 标签2]
cover: /images/cover.jpg (可选)
draft: false
---

文章内容...
```

### 创建项目

在 `src/content/projects/` 目录下创建 `.yaml` 文件：

```yaml
name: 项目名称
nameEn: Project Name
description: 项目描述
descriptionEn: Project description
techStack:
  - React
  - Node.js
github: https://github.com/user/repo
demo: https://demo.example.com
thumbnail: /images/thumbnail.jpg
featured: true
status: completed
order: 1
```

### 添加视频

编辑 `src/content/videos/index.yaml`：

```yaml
- title: 视频标题
  titleEn: Video Title
  description: 视频描述
  platform: bilibili # 或 youtube
  videoId: BV1xxxxxx
  thumbnail: /images/thumb.jpg
  duration: "10:30"
  pubDate: 2024-01-01
```

## 图片上传

上传图片到 Cloudflare R2（自动压缩为 WebP）：

```bash
# 基本用法
npm run upload:image <图片路径>

# 指定压缩质量 (默认 80)
npm run upload:image <图片路径> -q 70

# 指定最大宽度
npm run upload:image <图片路径> -w 1200

# 指定最大宽高
npm run upload:image <图片路径> -w 1200 -h 800

# 同时保存到本地
npm run upload:image <图片路径> -o ./output.webp
```

### 配置 R2

在 `.env` 文件中配置：

```env
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-domain.com
```

## 项目结构

```
├── src/
│   ├── components/        # UI 组件
│   │   ├── articles/      # 文章相关组件
│   │   ├── common/        # 通用组件
│   │   └── projects/      # 项目相关组件
│   ├── content/           # 内容集合
│   │   ├── articles/      # 博客文章
│   │   ├── projects/      # 项目数据
│   │   └── videos/        # 视频数据
│   ├── layouts/           # 布局模板
│   ├── pages/             # 页面路由
│   │   └── en/            # 英文页面
│   ├── styles/            # 全局样式
│   └── i18n/              # 国际化
├── public/                # 静态资源
├── scripts/               # 脚本工具
└── dist/                  # 构建输出
```

## 命令速查

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 预览构建结果 |
| `npm run upload:image` | 上传图片到 R2 |

## License

MIT
