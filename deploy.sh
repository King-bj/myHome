#!/bin/bash

# 部署配置 - 根据实际情况修改
SERVER_USER="ubuntu"                    # 服务器用户名
SERVER_HOST="152.136.63.155"          # 服务器 IP 或域名
REMOTE_PATH="/var/www/myHome/dist"    # 服务器上的部署路径

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始部署...${NC}"

# 1. 构建项目
echo -e "${YELLOW}📦 构建项目中...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 构建失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 构建完成${NC}"

# 2. 同步文件到服务器
echo -e "${YELLOW}📤 同步文件到服务器...${NC}"
rsync -avz --delete dist/ ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 文件同步失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 文件同步完成${NC}"

# 3. 重载 Nginx
echo -e "${YELLOW}🔄 重载 Nginx...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} "sudo nginx -t && sudo systemctl reload nginx"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Nginx 重载失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Nginx 重载完成${NC}"

# 4. 完成
echo ""
echo -e "${GREEN}🎉 部署成功！${NC}"
echo -e "访问地址: http://${SERVER_HOST}"
