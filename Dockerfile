# Use official Node.js 20 Alpine image as base (支持ARM架构)
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖
RUN apk add --no-cache libc6-compat

# 复制package文件以利用Docker缓存
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production=false

# 复制项目文件
COPY . .

# 设置构建时跳过数据库连接
ENV SKIP_DB=true
ENV NEXT_PHASE=phase-production-build

# 构建Next.js应用
RUN npm run build

# 清理开发依赖（可选，减小镜像大小）
# RUN npm prune --production

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 启动Next.js生产服务器
CMD ["npm", "start"]
