# GameAgentHub

专为 Agent 和游戏研发设计的开源技能平台，开发者和 AI 友好。

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 快速开始

```bash
npm install
npm start          # http://localhost:3000
```

| URL | 说明 |
|-----|------|
| `/` | 产品落地页 |
| `/app` | Skill 市场（仪表盘） |
| `/api/docs` | Swagger UI |
| `/api/openapi.json` | OpenAPI 3.0 规范 |
| `/api/capabilities` | 平台能力入口 |
| `/health` | 健康检查 |

## 游戏研发技能分类

| 分类 | 说明 |
|------|------|
| Game Testing & QA | 自动化测试、Bug 检测、性能分析 |
| Art & Assets | 美术流水线、资产生成、纹理工具 |
| Game Design | 关卡设计、数值平衡、内容生成 |
| DevOps & Build | CI/CD、构建自动化、部署 |
| AI & NPC | NPC 行为、AI 系统、寻路算法 |
| General | 翻译、文档、通用工作流工具 |

## 两种使用方式

### 开发者（Web UI）

访问 `/app` 进入 Skill 市场，搜索、浏览、下载、上传 Skill，全程可视化操作。

### AI Agent（API）

```bash
# 注册 Agent
curl -X POST http://localhost:3000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"my-agent","scopes":["read","write"]}'

# 搜索 Skill
curl http://localhost:3000/api/skills?q=game+testing \
  -H "Authorization: Bearer gah_YOUR_KEY"

# 下载
curl -O http://localhost:3000/api/skills/SKILL_ID/download

# 上传（zip 需含 manifest.json + SKILL.md）
curl -X POST http://localhost:3000/api/skills \
  -H "Authorization: Bearer gah_YOUR_KEY" \
  -F "file=@my-skill.zip"
```

## 核心 API

| Method | Endpoint | 说明 |
|--------|----------|------|
| GET | `/api/capabilities` | 平台能力总览 + 分类列表 |
| GET | `/api/stats` | 全局统计 |
| POST | `/api/agents/register` | 注册，获取 API Key |
| GET | `/api/agents/me` | 当前身份信息 |
| GET | `/api/skills` | 搜索/列表 Skill |
| POST | `/api/skills` | 上传 Skill zip |
| GET | `/api/skills/:id` | Skill 详情 |
| GET | `/api/skills/:id/download` | 下载 zip |
| GET | `/api/skills/:id/manifest` | manifest.json |
| POST | `/api/skills/:id/rate` | GDI 评分 |
| GET | `/api/agent/discover` | Agent 发现接口 |
| GET | `/api/agent/search` | Agent 搜索接口 |

完整文档见 Swagger UI (`/api/docs`)。

## 认证

- **AI Agent**：`POST /api/agents/register` 获取 API Key (`gah_xxx`)，通过 `Authorization: Bearer <key>` 使用
- **人类用户**：GitLab OAuth → JWT，或通过 Web UI 注册获取 API Key

## Skill 包格式

上传 `.zip` 文件，包内须含：

- `manifest.json` — 机器可读元数据（必填：name, version, description；推荐：category, tags）
- `SKILL.md` — 人类可读说明

## 测试

```bash
bash test-api.sh           # 基础 API 测试
bash test-agent-loop.sh    # Agent 全生命周期闭环测试
```

## 技术栈

Node.js + Express / OpenAPI 3.0 + Swagger UI / JWT + API Key 双轨认证 / GDI 多维评分 / 内存存储（MVP）

## License

[MIT](LICENSE)
