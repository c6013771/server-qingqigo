# server-qingqigo

「轻启er（QingQiEr）」清爽导航主页的后端服务，基于 NestJS 10 + Prisma 6 + MySQL 8 + Redis 7。

## 功能概览

- 用户系统：邮箱验证码注册、邮箱 + 密码登录（预留手机号、微信字段），JWT 认证
- 我的常去：登录用户的自定义收藏网站（最多 18 个，支持排序）
- 需求建议中心：匿名/登录提交需求，自动生成需求编号（`QYS-YYYYMMDD-XXX`），状态机流转，匿名提交按 IP 限流（每天 5 条，Redis 实现）
- 需求投票：登录用户点赞/取消点赞，一人一票（数据库唯一约束）
- 热榜接口：知乎/微博/百度热榜，Redis 缓存优先（TTL 10 分钟），未命中返回 mock 数据

## 目录结构

```
server-qingqigo/
├── prisma/schema.prisma        # 数据模型（users / user_favorites / feature_requests / request_votes）
├── src/
│   ├── main.ts                 # 入口：全局 ValidationPipe、前缀 /api、统一过滤器/拦截器
│   ├── app.module.ts
│   ├── config/                 # @nestjs/config + configuration.ts（类型化读取 env）
│   ├── common/                 # 公共层：全局异常过滤器、统一响应拦截器、@CurrentUser() 装饰器
│   ├── prisma/                 # PrismaModule（@Global）+ PrismaService
│   ├── redis/                  # RedisModule（@Global）+ RedisService（ioredis 封装）
│   └── modules/
│       ├── auth/               # 注册/登录、JWT 策略、JwtAuthGuard / OptionalJwtAuthGuard / AdminGuard
│       ├── users/              # 用户查询、GET /users/me
│       ├── favorites/          # 我的常去 CRUD（需登录，最多 12 个）
│       ├── requests/           # 需求提交（匿名 IP 限流）、列表、详情、投票、管理员改状态
│       └── hot-lists/          # 热榜接口（Redis 缓存优先）
├── docker-compose.yml          # 本地开发 MySQL 8 + Redis 7
└── .env.example                # 环境变量示例
```

统一响应格式：成功 `{ code: 0, message: 'ok', data }`，失败 `{ code: <httpStatus>, message, data: null }`。

## 环境准备

要求 Node.js >= 20（开发环境 v22.16.0）。

### 方式一：便携版（本机已配置好，推荐）

本机没有 Docker，MySQL 8.0 + Redis 5.0 以便携版形式装在 `F:\dev-services\`：

```bash
# 双击运行，或在命令行执行
F:\dev-services\start-services.bat    # 启动 MySQL(3306) + Redis(6379)
F:\dev-services\stop-services.bat     # 停止
```

MySQL 账号：`root` / `root123456`，数据库 `qingqigo`（已建好并完成迁移）。

### 方式二：Docker（如果装了 Docker Desktop）

```bash
# 1. 启动 MySQL 和 Redis
docker compose up -d

# 2. 配置环境变量
cp .env.example .env

# 3. 安装依赖
npm install

# 4. 生成 Prisma Client 并初始化数据库
npx prisma generate
npx prisma migrate dev --name init
```

## 启动

```bash
npm run start:dev    # 开发模式（node --watch + ts-node 热重载）
                     # 注意：不要用 tsx 跑本项目，esbuild 不生成 design:paramtypes
                     # 装饰器元数据，会导致 NestJS 依赖注入失败
npm run build        # 编译到 dist/
npm start            # 运行编译产物
```

服务默认监听 `http://localhost:3000/api`。

## 接口文档

启动服务后访问 Swagger UI：http://localhost:3000/api-docs

- 基于 @nestjs/swagger 自动生成，OpenAPI JSON 位于 http://localhost:3000/api-docs-json
- 文档界面右上角「Authorize」填入登录接口返回的 JWT（Bearer 模式），即可调试需登录的接口；刷新页面后 Token 保留（persistAuthorization）
- 注意文档挂载在 `/api-docs`，与业务全局前缀 `/api` 互不冲突

## API 列表

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| POST | /api/auth/register | 注册（email + password） | 否 |
| POST | /api/auth/login | 登录，返回 JWT | 否 |
| GET | /api/users/me | 当前用户信息 | 是 |
| GET | /api/favorites | 我的常去列表 | 是 |
| POST | /api/favorites | 添加常去（最多 12 个） | 是 |
| PATCH | /api/favorites/:id | 修改常去 | 是 |
| DELETE | /api/favorites/:id | 删除常去 | 是 |
| POST | /api/requests | 提交需求（匿名有 IP 限流：5 条/天） | 可选 |
| GET | /api/requests | 需求列表（分页，可按 status 过滤） | 否 |
| GET | /api/requests/mine | 我的需求列表 | 是 |
| GET | /api/requests/:id | 需求详情 | 否 |
| POST | /api/requests/:id/vote | 点赞 / 取消点赞（toggle） | 是 |
| PATCH | /api/requests/:id/status | 管理员修改需求状态 | 是（admin） |
| GET | /api/hot-lists?source=zhihu\|weibo\|baidu | 热榜（缓存 10 分钟） | 否 |

管理员账号：将 users 表中对应记录的 `role` 字段改为 `admin` 即可。
