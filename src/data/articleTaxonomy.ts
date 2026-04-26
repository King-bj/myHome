import type { CollectionEntry } from 'astro:content';

type Lang = 'zh' | 'en';

interface CategoryDef {
  key: string;
  labelZh: string;
  labelEn: string;
  tags: string[];
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'automation-practice',
    labelZh: '自动化实践',
    labelEn: 'Automation Practice',
    tags: ['自动化', 'automation', 'tooling', '工具箱'],
  },
  {
    key: 'ai-collaboration',
    labelZh: 'AI 协作',
    labelEn: 'AI Collaboration',
    tags: ['ai', 'agent', 'skill', 'llm'],
  },
  {
    key: 'engineering-troubleshooting',
    labelZh: '工程排障',
    labelEn: 'Engineering Troubleshooting',
    tags: [ '性能优化', 'performance optimization'],
  },
  {
    key: 'product-delivery',
    labelZh: '产品交付',
    labelEn: 'Product Delivery',
    tags: ['product design', '产品设计'],
  },
];

const FALLBACK_CATEGORY = {
  key: 'general-practice',
  labelZh: '实践沉淀',
  labelEn: 'Field Notes',
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function findCategoryByTags(tags: string[]): CategoryDef | null {
  const tagSet = new Set(tags.map(normalizeTag));
  const priority: Record<string, number> = {
    'product-delivery': 4,
    'ai-collaboration': 3,
    'engineering-troubleshooting': 2,
    'automation-practice': 1,
  };

  let best: { category: CategoryDef; score: number; priority: number } | null = null;

  for (const category of CATEGORY_DEFS) {
    const score = category.tags.filter((tag) => tagSet.has(normalizeTag(tag))).length;
    if (score === 0) {
      continue;
    }

    const current = {
      category,
      score,
      priority: priority[category.key] ?? 0,
    };

    if (!best) {
      best = current;
      continue;
    }

    if (current.score > best.score) {
      best = current;
      continue;
    }

    if (current.score === best.score && current.priority > best.priority) {
      best = current;
    }
  }

  return best?.category ?? null;
}

export function getArticleCategory(tags: string[], lang: Lang): { key: string; label: string } {
  const matched = findCategoryByTags(tags);
  if (!matched) {
    return {
      key: FALLBACK_CATEGORY.key,
      label: lang === 'en' ? FALLBACK_CATEGORY.labelEn : FALLBACK_CATEGORY.labelZh,
    };
  }

  return {
    key: matched.key,
    label: lang === 'en' ? matched.labelEn : matched.labelZh,
  };
}

export function buildCategorySummary(
  articles: CollectionEntry<'articles'>[],
  lang: Lang
): { key: string; label: string; count: number }[] {
  const counts = new Map<string, { key: string; label: string; count: number }>();

  for (const article of articles) {
    const category = getArticleCategory(article.data.tags, lang);
    const existing = counts.get(category.key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    counts.set(category.key, { ...category, count: 1 });
  }

  return Array.from(counts.values()).sort((a, b) => b.count - a.count);
}
