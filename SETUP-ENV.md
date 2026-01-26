# 环境变量配置指南

## 问题说明

如果 Container Manager 报错找不到 `.env` 文件，您有两个选择：

## 方案 1: 创建 .env 文件（推荐）

1. 在项目目录 `/Projects/openstack` 中创建 `.env` 文件
2. 复制 `env.example` 的内容到 `.env`
3. 根据实际情况修改配置

### 在 Container Manager 中创建文件：

1. 打开 **File Station**
2. 导航到 `/Projects/openstack`
3. 创建新文件，命名为 `.env`
4. 编辑文件，复制 `env.example` 的内容并修改

### 通过 SSH 创建：

```bash
cd /Projects/openstack
cp env.example .env
# 然后编辑 .env 文件，填入您的实际配置
```

### 必需的环境变量：

至少需要配置以下变量：

```env
NODE_ENV=production
MONGODB_URI=mongodb://root:你的密码@mongodb:27017/openstock?authSource=admin
MONGO_ROOT_PASSWORD=你的MongoDB密码
BETTER_AUTH_SECRET=你的随机密钥（使用 openssl rand -base64 32 生成）
BETTER_AUTH_URL=http://你的NAS-IP:3000
NEXT_PUBLIC_FINNHUB_API_KEY=你的Finnhub密钥
```

## 方案 2: 通过 Container Manager 界面配置

如果不想创建 `.env` 文件，可以在 Container Manager 中直接配置环境变量：

1. 在 Container Manager 中编辑项目
2. 找到 `openstock` 服务
3. 在环境变量部分添加所需的变量
4. 保存并重新部署

## 当前配置说明

当前的 `docker-compose.yml` 已经注释掉了 `env_file`，所以即使没有 `.env` 文件也不会报错。但是您仍然需要配置必要的环境变量，可以通过：

- 创建 `.env` 文件（然后取消注释 docker-compose.yml 中的 env_file）
- 或者在 Container Manager 的界面中手动添加环境变量

## 重要提示

- `BETTER_AUTH_SECRET` 必须是一个强随机密钥
- `NEXT_PUBLIC_FINNHUB_API_KEY` 是必需的，否则应用无法获取股票数据
- `BETTER_AUTH_URL` 应该使用您的 NAS IP 地址或域名
