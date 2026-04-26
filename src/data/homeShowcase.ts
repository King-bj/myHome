export interface HomeShowcaseImage {
  src: string;
  altZh: string;
  altEn: string;
  href?: string;
}

export const homeShowcaseImages: HomeShowcaseImage[] = [
  {
    src: 'https://images.jinla.fun/images/20260405-165d7df2-头像.webp',
    altZh: '头像与品牌形象',
    altEn: 'Profile and brand identity',
  },
  {
    src: 'https://images.jinla.fun/images/20260412-2acbe7cb-ssh.webp',
    altZh: '批量 SSH 巡检实践',
    altEn: 'Batch SSH inspection practice',
  },
  {
    src: 'https://images.jinla.fun/images/20260412-4ae333fc-top.webp',
    altZh: 'JVM 性能排障案例',
    altEn: 'JVM troubleshooting case study',
  },
  {
    src: 'https://images.jinla.fun/images/20260419-d424bb49-知道何时停手-MindRound-从0到1的工程实践.webp',
    altZh: 'MindRound 产品交付实践',
    altEn: 'MindRound product delivery practice',
  },
  {
    src: 'https://images.jinla.fun/images/20260406-c184d5d9-闲时谈富.webp',
    altZh: '内容与品牌渠道',
    altEn: 'Content and brand channel',
    href: 'https://space.bilibili.com/256223451',
  },
];
