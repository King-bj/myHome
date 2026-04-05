#!/usr/bin/env node

import { program } from 'commander';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载 .env 文件
dotenv.config({ path: path.join(__dirname, '.env') });

// R2 配置
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_DOMAIN || process.env.R2_PUBLIC_URL; // 自定义域名

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('❌ 缺少必要的 R2 配置，请检查 .env 文件');
  console.error('需要的配置项: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  process.exit(1);
}

// 创建 S3 客户端 (R2 兼容 S3 API)
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 压缩图片为 WebP 格式
 * @param {string} inputPath - 输入图片路径
 * @param {Object} options - 压缩选项
 * @returns {Promise<Buffer>} - 压缩后的图片 Buffer
 */
async function compressToWebP(inputPath, options = {}) {
  const { quality = 80, width = null, height = null } = options;

  let pipeline = sharp(inputPath);

  // 调整尺寸
  if (width || height) {
    pipeline = pipeline.resize(width, height, { fit: 'inside' });
  }

  // 转换为 WebP
  const buffer = await pipeline
    .webp({ quality, effort: 4 })
    .toBuffer();

  return buffer;
}

/**
 * 生成唯一文件名
 * @param {string} originalName - 原始文件名
 * @returns {string} - 新文件名
 */
function generateFilename(originalName) {
  const ext = '.webp';
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const hash = crypto.randomBytes(4).toString('hex');
  const baseName = path.basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
    .slice(0, 50);

  return `${timestamp}-${hash}-${baseName}${ext}`;
}

/**
 * 上传到 R2
 * @param {Buffer} buffer - 图片 Buffer
 * @param {string} filename - 文件名
 * @returns {Promise<string>} - 图片 URL
 */
async function uploadToR2(buffer, filename) {
  const key = `images/${filename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/webp',
  });

  await s3Client.send(command);

  // 返回公开 URL
  const baseUrl = R2_PUBLIC_URL || `https://pub-${R2_ACCOUNT_ID}.r2.dev`;
  return `${baseUrl}/${key}`;
}

/**
 * 主函数
 */
async function main() {
  program
    .name('upload-image')
    .description('压缩图片为 WebP 并上传到 Cloudflare R2')
    .argument('<input>', '输入图片路径')
    .option('-q, --quality <number>', 'WebP 质量 (1-100)', '80')
    .option('-w, --width <number>', '最大宽度')
    .option('-h, --height <number>', '最大高度')
    .option('-o, --output <path>', '保存压缩后的图片到本地（可选）')
    .parse();

  const options = program.opts();
  const inputPath = program.args[0];

  // 验证输入文件
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 文件不存在: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📷 处理图片: ${inputPath}`);

  try {
    // 获取原始文件大小
    const originalStat = fs.statSync(inputPath);
    const originalSize = originalStat.size;

    // 压缩图片
    console.log('🔄 压缩中...');
    const compressOptions = {
      quality: parseInt(options.quality),
      width: options.width ? parseInt(options.width) : null,
      height: options.height ? parseInt(options.height) : null,
    };

    const webpBuffer = await compressToWebP(inputPath, compressOptions);
    const compressedSize = webpBuffer.length;
    const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`✅ 压缩完成: ${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB (节省 ${savedPercent}%)`);

    // 保存到本地（可选）
    if (options.output) {
      fs.writeFileSync(options.output, webpBuffer);
      console.log(`💾 已保存到: ${options.output}`);
    }

    // 生成文件名并上传
    const filename = generateFilename(inputPath);
    console.log('☁️ 上传中...');
    const url = await uploadToR2(webpBuffer, filename);

    console.log('\n✨ 上传成功！');
    console.log(`🔗 URL: ${url}`);

    // 输出 Markdown 格式
    console.log(`\n📝 Markdown: ![image](${url})`);

  } catch (error) {
    console.error('❌ 处理失败:', error.message);
    process.exit(1);
  }
}

main();
