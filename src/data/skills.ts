export const skills = [
  {
    name: '后端开发',
    nameEn: 'Backend Development',
    items: ['Java', 'Python', 'Go', 'Spring Boot', 'MyBatis', 'MySQL', 'PostgreSQL', 'Redis'],
  },
  {
    name: '大数据与中间件',
    nameEn: 'Big Data & Middleware',
    items: ['Kafka', 'Flink', 'Elasticsearch', 'Drools', 'Docker', 'Kubernetes'],
  },
  {
    name: 'AI/ML',
    nameEn: 'AI/ML',
    items: ['LangChain', 'OpenAI API', 'Claude API', 'RAG', 'Prompt Engineering'],
  },
  {
    name: '工具与其他',
    nameEn: 'Tools & Others',
    items: ['Git', 'Linux', 'CI/CD', 'JVM调优', 'Arthas', 'Cloudflare'],
  },
];

export type SkillCategory = typeof skills[0];
