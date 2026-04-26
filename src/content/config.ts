import { defineCollection, z } from 'astro:content';

// Projects collection
const projectsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    nameEn: z.string().optional(),
    description: z.string(),
    descriptionEn: z.string().optional(),
    techStack: z.array(z.string()),
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
    thumbnail: z.string(),
    screenshots: z.array(z.string()).optional(),
    featured: z.boolean().default(false),
    status: z.enum(['completed', 'in-progress', 'archived']).default('completed'),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    order: z.number().default(0),
  }),
});

// Articles collection - bilingual support with zh/en subdirectories
const articlesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()),
    cover: z.string().optional(),
    /** Full Bilibili video URL (e.g. https://www.bilibili.com/video/BV...). When set, article page shows a “watch video” shortcut. */
    bilibiliVideoUrl: z.string().url().optional(),
    // Cross-language slug for linking between zh/en versions
    slugEn: z.string().optional(),  // Used in zh articles to link to English version
    slugZh: z.string().optional(),  // Used in en articles to link to Chinese version
    externalLinks: z
      .array(
        z.object({
          platform: z.enum(['juejin', 'medium', 'dev.to', 'zhihu', 'other']),
          url: z.string().url(),
        })
      )
      .optional(),
    draft: z.boolean().default(false),
  }),
});

// Videos collection
const videosCollection = defineCollection({
  type: 'data',
  schema: z.array(
    z.object({
      title: z.string(),
      titleEn: z.string().optional(),
      description: z.string().optional(),
      descriptionEn: z.string().optional(),
      platform: z.enum(['bilibili', 'youtube']),
      videoId: z.string(),
      thumbnail: z.string().optional(),
      duration: z.string().optional(),
      pubDate: z.coerce.date(),
    })
  ),
});

export const collections = {
  projects: projectsCollection,
  articles: articlesCollection,
  videos: videosCollection,
};
