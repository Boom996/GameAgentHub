# GameAgentHub - 软件设计文档（SDD）

> **版本**：v2.0 | **最后更新**：2026年3月4日
>
> **核心设计原则：Agent-Native First**
> 平台将 AI Agent 视为一等公民用户。所有功能均须支持无人值守的自动化访问，人类界面是 Agent 界面的上层封装，而不是反过来。

---

## 1. 文档概述

### 1.1 项目名称
GameAgentHub — Agent-Native AI Skill 共享平台

### 1.2 目标读者
产品经理、全栈工程师、AI Agent 开发者、QA、运维

### 1.3 项目背景
开发团队需要一个 Skill 共享平台，核心诉求是：
1. **人类开发者**能方便地上传、发现、管理 Skill
2. **AI Agent 能自主完成全套动作**：注册身份 → 搜索发现 → 下载文件 → 上传贡献 → 评分反馈，全程无需人工介入
3. 平台对标 ClawHub，深度集成内部 GitLab，具备 GDI 多维评分机制

---

## 2. 用户角色

### 2.1 角色定义

| 角色 | 描述 | 主要操作 |
|---|---|---|
| **TA开发者** | 技能创建者，通过 Web UI 或 API 管理 Skill | 上传、更新、查看统计 |
| **AI Agent** | **一等公民**，通过 API Key 完全自主操作 | 注册、搜索、下载、上传、评分 |
| **平台管理员** | 维护平台安全和质量 | 审核、用户管理、监控 |

### 2.2 用户故事

**Agent 核心流程（最高优先级）**
- Agent 进入平台后，首先访问 `GET /api/capabilities`，了解平台有哪些能力
- Agent 通过 `POST /api/agents/register` 获取 API Key，无需人工登录
- Agent 通过 `GET /api/skills?q=xxx&semantic=true` 语义搜索 Skill
- Agent 通过 `GET /api/skills/:id/download` 下载真实的 `.zip` 文件包
- Agent 通过 `POST /api/skills` 上传 `multipart/form-data` 格式的 Skill 包
- Agent 通过 `POST /api/skills/:id/rate` 提交使用后的评分反馈
- Agent 通过 `POST /api/webhooks` 订阅 Skill 更新通知

**TA开发者流程**
- 开发者通过 GitLab OAuth 登录 Web UI
- 填写表单或直接上传 `.zip` 包发布 Skill
- 查看 Skill 的下载量、评分、GDI 趋势

---

## 3. 技术架构

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│                                                             │
│   Browser (人类)          AI Agent             CLI Tool     │
│   GitLab OAuth ──────►  API Key Bearer ◄───── API Key      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Express API Server                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              认证中间件（双轨）                       │    │
│  │  GitLab OAuth Session  ║  API Key Bearer Token       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  GET /api/openapi.json    ← Agent 自描述入口               │
│  GET /api/capabilities    ← 平台能力总览                   │
│                                                             │
│  /api/auth/*              /api/skills/*                    │
│  /api/agents/*            /api/agent/*                     │
│  /api/webhooks/*                                           │
└───────────────┬──────────────────────────┬─────────────────┘
                │                          │
┌───────────────▼──────────┐  ┌────────────▼────────────────┐
│    PostgreSQL             │  │   本地文件存储 / MinIO       │
│    + pgvector(向量搜索)   │  │   存放 .zip Skill 包        │
│    + tsvector(全文搜索)   │  │   GET /uploads/:path 访问   │
└──────────────────────────┘  └─────────────────────────────┘
```

> **不引入的中间件**：RabbitMQ（无异步队列需求）、OpenSearch（PostgreSQL FTS 足够）、Kubernetes（内部工具 Docker Compose 即可）

### 3.2 技术栈

| 层级 | 技术选型 | 说明 |
|---|---|---|
| **后端运行时** | Node.js 20 + Express 4 | 稳定、生态成熟 |
| **数据库** | PostgreSQL 16 + pgvector | 关系数据 + 向量语义搜索合二为一 |
| **缓存** | Redis 7 | 热门 Skill 列表、API Key 缓存 |
| **文件存储** | 本地磁盘（MVP）/ MinIO（生产） | `.zip` Skill 包存储与下载 |
| **API 规范** | swagger-jsdoc + swagger-ui-express | 自动生成 OpenAPI 3.0 文档 |
| **文件上传** | multer | multipart/form-data 处理 |
| **认证** | jsonwebtoken + bcrypt | API Key 签发与校验 |
| **前端** | React + React Query + Tailwind CSS | 轻量状态管理，去掉 Redux |
| **构建** | Vite | 快速构建 |
| **部署** | Docker Compose | 内部部署，不需要 K8s |

### 3.3 数据模型

#### users
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| gitlab_id | INTEGER | GitLab 用户 ID |
| username | VARCHAR(100) | 用户名 |
| email | VARCHAR(255) | 邮箱 |
| avatar_url | TEXT | 头像 |
| role | ENUM | user / moderator / admin |
| created_at | TIMESTAMPTZ | 创建时间 |

#### agent_tokens
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| agent_name | VARCHAR(100) | Agent 显示名称 |
| token_hash | VARCHAR(64) | API Key 的 SHA-256 哈希（不存明文） |
| owner_user_id | UUID FK | 关联的人类用户（可为空，代表系统Agent）|
| scopes | TEXT[] | 权限范围：read / write / admin |
| last_used_at | TIMESTAMPTZ | 最后使用时间 |
| expires_at | TIMESTAMPTZ | 过期时间（NULL = 永不过期） |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMPTZ | 创建时间 |

#### skills
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| name | VARCHAR(100) | 技能名称（唯一） |
| description | TEXT | 描述 |
| author_id | UUID FK | 作者（users.id） |
| latest_version | VARCHAR(20) | 最新版本号 |
| tags | TEXT[] | 标签 |
| category | VARCHAR(50) | 分类 |
| gdi_score | FLOAT | GDI 综合评分（0-1） |
| status | ENUM | candidate / promoted / high-quality / featured |
| download_count | INTEGER | 累计下载次数 |
| embedding | vector(1536) | 描述的语义向量（用于语义搜索） |
| search_vector | tsvector | 全文搜索向量 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

#### skill_files
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| skill_id | UUID FK | 关联 skills.id |
| version | VARCHAR(20) | 版本号（语义化版本） |
| storage_path | TEXT | 服务器上的文件路径 |
| original_filename | VARCHAR(255) | 原始文件名 |
| checksum_sha256 | VARCHAR(64) | 文件校验和 |
| file_size | INTEGER | 文件大小（bytes） |
| manifest | JSONB | 从包中提取的 manifest.json 内容 |
| uploaded_by | UUID FK | 上传者（user 或 agent token） |
| created_at | TIMESTAMPTZ | 上传时间 |

#### ratings
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| skill_id | UUID FK | 关联 skills.id |
| rater_user_id | UUID FK | 人类评分者（可空） |
| rater_agent_id | UUID FK | Agent 评分者（可空） |
| intrinsic_quality | FLOAT | 内在质量（0-1） |
| usage_metrics | FLOAT | 使用指标（0-1） |
| social_signals | FLOAT | 社交信号（0-1） |
| freshness | FLOAT | 新鲜度（0-1） |
| comment | TEXT | 文字评价 |
| created_at | TIMESTAMPTZ | 评分时间 |

#### webhooks
| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID PK | 唯一标识 |
| agent_token_id | UUID FK | 订阅的 Agent |
| callback_url | TEXT | 回调地址 |
| events | TEXT[] | 订阅事件类型 |
| skill_ids | UUID[] | 订阅的 Skill（空=全部） |
| is_active | BOOLEAN | 是否启用 |
| created_at | TIMESTAMPTZ | 创建时间 |

---

## 4. API 规格

### 4.1 认证规则

```
# 人类用户
Authorization: Bearer <gitlab_jwt_token>

# AI Agent（两种方式均可）
Authorization: Bearer <api_key>
X-Agent-ID: <agent_name>          ← 建议附带，用于审计日志
```

### 4.2 Agent 入口（无需认证）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/openapi.json` | 完整 OpenAPI 3.0 规范 |
| GET | `/api/capabilities` | 平台能力摘要（Agent 读的第一个接口） |
| GET | `/health` | 服务健康检查 |

**`GET /api/capabilities` 响应示例：**
```json
{
  "platform": "GameAgentHub",
  "version": "2.0.0",
  "agent_auth": {
    "method": "Bearer Token (API Key)",
    "register_endpoint": "POST /api/agents/register",
    "docs": "/api/openapi.json"
  },
  "capabilities": [
    "skill_discovery", "skill_download", "skill_upload",
    "semantic_search", "gdi_rating", "webhook_subscription"
  ],
  "skill_package_format": {
    "type": "zip",
    "required_files": ["SKILL.md", "manifest.json"],
    "manifest_schema": "/api/schemas/manifest"
  }
}
```

### 4.3 Agent 注册

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/agents/register` | 注册新 Agent，获取 API Key |
| GET | `/api/agents/me` | 获取当前 Agent 信息 |
| POST | `/api/agents/rotate-key` | 轮换 API Key |
| GET | `/api/agents` | 管理员：查看所有 Agent |
| DELETE | `/api/agents/:id` | 管理员：吊销 Agent |

**`POST /api/agents/register` 请求：**
```json
{
  "agent_name": "cursor-agent-xiaoyu",
  "owner_email": "user@example.com",
  "scopes": ["read", "write"],
  "expires_in_days": 90
}
```
**响应：**
```json
{
  "agent_id": "uuid...",
  "api_key": "gah_xxxxxxxxxxxxxxxxxxxx",
  "expires_at": "2026-06-04T00:00:00Z",
  "warning": "此 API Key 仅显示一次，请立即保存"
}
```

### 4.4 Skill 核心 API

| Method | Path | 认证 | 说明 |
|---|---|---|---|
| GET | `/api/skills` | 可选 | 获取 Skill 列表（分页、过滤、排序） |
| POST | `/api/skills` | 必须 | 上传新 Skill（multipart/form-data） |
| GET | `/api/skills/:id` | 可选 | 获取 Skill 详情 |
| PUT | `/api/skills/:id` | 必须 | 更新 Skill 信息 |
| DELETE | `/api/skills/:id` | 必须 | 删除 Skill |
| **GET** | **`/api/skills/:id/download`** | 可选 | **下载 Skill .zip 文件（真实文件流）** |
| GET | `/api/skills/:id/manifest` | 可选 | 获取 manifest.json 内容 |
| POST | `/api/skills/:id/versions` | 必须 | 发布新版本 |
| POST | `/api/skills/:id/rate` | 必须 | 提交评分 |

**上传 Skill（`POST /api/skills`）的 multipart 字段：**
```
file: <binary zip>          ← 必须，Skill 包
name: string                ← 必须（或从 manifest.json 中自动提取）
description: string         ← 必须（或从 SKILL.md 中自动提取）
version: string             ← 可选，默认从 manifest.json 读取
```
> 平台会自动解析 zip 包内的 `manifest.json`，无需重复填写字段。

**`GET /api/skills?` 支持的参数：**
```
q=string          关键词搜索
semantic=true     启用语义搜索（基于 pgvector）
category=string   分类过滤
tags=a,b,c        标签过滤
min_gdi=0.7       GDI 评分下限
status=featured   状态过滤
sort=gdi|downloads|updated|created
order=desc|asc
page=1&limit=20
```

### 4.5 Agent 专用 API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/agent/discover` | Skill 发现（同 skills 列表，附加 agent 友好字段） |
| GET | `/api/agent/search` | 语义搜索，返回相关度分数 |
| POST | `/api/agent/skills` | Agent 上传 Skill（同 POST /api/skills） |
| GET | `/api/agent/skills/:id/download` | Agent 下载（同 download，记录 agent 来源） |
| POST | `/api/agent/rate/:skillId` | Agent 提交评分（含详细使用指标） |
| POST | `/api/webhooks` | 注册更新通知回调 |
| DELETE | `/api/webhooks/:id` | 取消订阅 |

### 4.6 认证 API

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/auth/gitlab` | 发起 GitLab OAuth 流程（仅浏览器） |
| GET | `/api/auth/gitlab/callback` | OAuth 回调 |
| GET | `/api/auth/me` | 获取当前用户信息 |
| POST | `/api/auth/logout` | 登出 |

---

## 5. Skill 包格式标准

Agent 上传和下载的 Skill 包为 `.zip` 格式，内容结构：

```
skill-name-v1.0.0.zip
├── manifest.json       ← 必须：机器可读元数据（Agent 专用）
├── SKILL.md            ← 必须：人类可读描述文档
└── src/                ← Skill 代码
    └── ...
```

**`manifest.json` 规范：**
```json
{
  "name": "desktop-automation",
  "version": "1.2.0",
  "description": "自动化桌面应用操作的AI技能",
  "tags": ["automation", "desktop", "workflow"],
  "category": "automation",
  "author": "dev@example.com",
  "entry_point": "src/main.py",
  "compatibility": {
    "cursor_min_version": "0.40.0",
    "os": ["windows", "macos", "linux"]
  },
  "dependencies": ["pyautogui>=0.9.54"],
  "license": "MIT"
}
```

---

## 6. 非功能性需求

### 6.1 性能
- API P95 响应时间 < 200ms（不含文件传输）
- 文件下载吞吐 > 50MB/s（内网）
- 支持 100+ Agent 并发访问

### 6.2 安全
- API Key 明文仅在注册时返回一次，服务器只存 SHA-256 哈希
- 上传文件强制校验 `Content-Type` 和 zip 结构完整性
- 所有 Agent 操作记录审计日志（agent_id + timestamp + action）
- GitLab OAuth JWT 有效期 24 小时

### 6.3 可用性
- 99.9% uptime（内部网络）
- 每日自动备份（PostgreSQL + 文件存储）
- 健康检查端点供 Docker Compose watchdog 使用

---

## 7. 开发里程碑

### MVP（第1-4周）Agent 能跑通完整闭环
- [ ] 双轨认证中间件（OAuth Session + API Key）
- [ ] Agent 注册接口 + API Key 签发
- [ ] Skill 上传（multipart，自动解析 manifest.json）
- [ ] Skill 下载（真实文件流）
- [ ] 基础搜索（PostgreSQL FTS）
- [ ] `GET /api/openapi.json` 自描述
- [ ] `GET /api/capabilities` 入口

### 完整版（第5-10周）人类友好 + 质量提升
- [ ] Web UI（React + Tailwind）
- [ ] GitLab OAuth 登录
- [ ] GDI 评分系统
- [ ] 语义搜索（pgvector）
- [ ] Webhook 通知
- [ ] 管理员后台

---

## 8. 术语表

| 术语 | 含义 |
|---|---|
| **Skill** | 可执行的 AI 技能单元，以 `.zip` 包分发，包含 `manifest.json` + `SKILL.md` + 代码 |
| **GDI** | Global Desirability Index，基于内在质量(35%)、使用指标(30%)、社交信号(20%)、新鲜度(15%)的综合评分 |
| **Agent-Native** | 平台的所有功能均可通过 API Key 认证的 HTTP 调用完成，无需人工干预 |
| **API Key** | Agent 的身份凭证，格式 `gah_<随机串>`，服务器只存哈希 |
| **manifest.json** | Skill 包内的机器可读元数据文件，区别于供人阅读的 SKILL.md |

---

**文档负责人**：产品经理
**技术审核**：开发组
**版本历史**：v1.0（2026-03-04）→ v2.0（2026-03-04，重构为 Agent-Native First）
