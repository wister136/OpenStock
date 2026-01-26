# OpenStock 在 DS925+ Container Manager 上的部署指南

本指南将帮助您在 Synology DS925+ 的 Container Manager 上部署 OpenStock 应用。

## 📋 前置要求

1. **DS925+ NAS** 已安装并运行 DSM 7.0 或更高版本
2. **Container Manager** 已安装并启用
3. **Docker** 支持（Container Manager 已包含）
4. 至少 **2GB** 可用内存
5. 至少 **10GB** 可用存储空间

## 🚀 部署步骤

### 步骤 1: 准备项目文件

1. 将项目文件上传到 DS925+ 的共享文件夹（例如：`/Projects/openstack`）
2. 或者通过 SSH 连接到 NAS 并使用 git clone：
   ```bash
   cd /Projects
   git clone <your-repo-url> openstock
   cd openstock
   ```

### 步骤 2: 配置环境变量

1. 在项目根目录创建 `.env` 文件
2. 复制 `.env.example` 的内容到 `.env`
3. 根据您的实际情况修改以下关键配置：

   ```env
   # 数据库连接（使用docker-compose中的MongoDB）
   MONGODB_URI=mongodb://root:你的密码@mongodb:27017/openstock?authSource=admin
   MONGO_ROOT_PASSWORD=你的MongoDB密码
   
   # Better Auth密钥（生成随机密钥）
   BETTER_AUTH_SECRET=你的随机密钥
   
   # 使用NAS的IP地址或域名
   BETTER_AUTH_URL=http://你的NAS-IP:3000
   
   # Finnhub API密钥（必需）
   NEXT_PUBLIC_FINNHUB_API_KEY=你的Finnhub密钥
   ```

### 步骤 3: 在 Container Manager 中部署

#### 方法 A: 使用 docker-compose.yml（推荐）

1. 打开 **Container Manager**
2. 点击左侧菜单的 **项目**
3. 点击 **创建** 按钮
4. 选择 **从 docker-compose.yml 创建**
5. 项目名称：`openstock`
6. 路径：选择包含 `docker-compose.yml` 的文件夹（例如：`/Projects/openstack`）
7. 点击 **下一步**
8. 确认配置后点击 **完成**
9. Container Manager 将自动构建镜像并启动容器

#### 方法 B: 手动创建容器

如果方法 A 不可用，可以手动创建：

1. **构建镜像**：
   - 打开 Container Manager
   - 点击 **镜像** → **添加** → **从文件构建**
   - 选择项目目录中的 `Dockerfile`
   - 镜像名称：`openstock:latest`
   - 点击 **构建**

2. **创建 MongoDB 容器**：
   - 点击 **容器** → **创建**
   - 搜索并选择 `mongo:7`
   - 容器名称：`openstock-mongodb`
   - 端口设置：不对外暴露（或仅本地：`127.0.0.1:27017:27017`）
   - 环境变量：
     - `MONGO_INITDB_ROOT_USERNAME`: `root`
     - `MONGO_INITDB_ROOT_PASSWORD`: `你的密码`
   - 卷：创建新卷 `mongo-data` 挂载到 `/data/db`
   - 重启策略：`除非停止`
   - 点击 **完成**

3. **创建 OpenStock 应用容器**：
   - 点击 **容器** → **创建**
   - 选择 **使用本地镜像** → `openstock:latest`
   - 容器名称：`openstock-app`
   - 端口设置：`3000:3000`
   - 环境变量：导入 `.env` 文件或手动添加
   - 网络：连接到 `openstock-mongodb` 所在的网络（或创建新网络）
   - 重启策略：`除非停止`
   - 点击 **完成**

### 步骤 4: 验证部署

1. 等待容器启动完成（查看日志确认）
2. 打开浏览器访问：`http://你的NAS-IP:3000`
3. 如果看到 OpenStock 登录页面，说明部署成功

## 🔧 配置说明

### 端口配置

- **OpenStock 应用**：`3000`（可在 Container Manager 中修改）
- **MongoDB**：建议不对外暴露，仅在 Docker 网络内访问

### 数据持久化

MongoDB 数据默认存储在 Docker 卷中。如果需要备份或迁移：

1. **使用 Docker 卷**（推荐）：
   - 数据存储在 `/var/lib/docker/volumes/`（由 Container Manager 管理）
   - 可以通过 Container Manager 的卷管理功能备份

2. **使用绑定挂载**（可选）：
   - 修改 `docker-compose.yml` 中的 volumes 配置：
     ```yaml
     volumes:
       - /Projects/openstack/mongodb:/data/db
     ```
   - 这样数据会存储在共享文件夹中，便于备份

### 网络配置

- 容器使用 `bridge` 网络模式
- OpenStock 和 MongoDB 在同一网络中，可以通过服务名互相访问
- MongoDB 服务名：`mongodb`
- OpenStock 服务名：`openstock`

## 🔄 更新应用

1. 停止容器
2. 拉取最新代码或更新项目文件
3. 重新构建镜像（如果代码有更新）
4. 启动容器

在 Container Manager 中：
- 选择项目 → **操作** → **重新创建**
- 或手动停止、删除、重新创建容器

## 🐛 故障排除

### 容器无法启动

1. 查看容器日志：
   - Container Manager → 容器 → 选择容器 → **详情** → **日志**
2. 检查环境变量是否正确
3. 检查端口是否被占用
4. 检查磁盘空间是否充足

### 无法连接数据库

1. 确认 MongoDB 容器已启动并健康
2. 检查 `MONGODB_URI` 中的密码是否正确
3. 确认容器在同一网络中
4. 查看 MongoDB 容器日志

### 应用无法访问

1. 检查防火墙设置（DSM → 控制面板 → 安全性 → 防火墙）
2. 确认端口 3000 已开放
3. 检查容器是否正常运行
4. 查看应用容器日志

### 构建失败

1. 检查 Dockerfile 语法
2. 确认网络连接正常（需要下载依赖）
3. 检查磁盘空间
4. 查看构建日志

## 📝 注意事项

1. **安全性**：
   - 修改默认的 MongoDB 密码
   - 使用强密码生成 `BETTER_AUTH_SECRET`
   - 不要在 `.env` 文件中提交敏感信息到版本控制

2. **性能**：
   - DS925+ 是 ARM 架构，确保使用兼容的镜像
   - 建议分配至少 2GB 内存给容器
   - 定期清理未使用的镜像和卷

3. **备份**：
   - 定期备份 MongoDB 数据
   - 备份 `.env` 配置文件
   - 考虑使用 Synology 的备份工具

4. **资源限制**：
   - 可以在 Container Manager 中设置 CPU 和内存限制
   - 监控资源使用情况

## 🔗 相关链接

- [Synology Container Manager 文档](https://kb.synology.com/zh-cn/DSM/help/DSM/ContainerManager/container_manager_desc)
- [OpenStock 项目文档](./README.md)
- [Docker Compose 文档](https://docs.docker.com/compose/)

## 💡 提示

- 首次启动可能需要几分钟来构建镜像和下载依赖
- 建议在测试环境先验证配置
- 定期更新镜像以获得安全补丁
- 使用 Container Manager 的日志功能监控应用状态

---

如有问题，请查看项目 GitHub Issues 或提交新的 Issue。