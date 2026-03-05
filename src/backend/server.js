const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const authRoutes = require('./routes/auth');
const skillRoutes = require('./routes/skills');
const agentRoutes = require('./routes/agent');
const agentsRoutes = require('./routes/agents');
const { skills } = require('./store');
const { listAgents } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ── 安全与解析中间件 ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP 关闭以便 Swagger UI 正常工作
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Agent-ID'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── OpenAPI 3.0 规范生成 ──────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GameAgentHub API',
      version: '2.0.0',
      description: `
# GameAgentHub — AI Skill 共享平台 API

**Agent-Native First**：所有功能均可通过 API 无人值守地完成。

## Agent 快速开始

1. 调用 \`GET /api/capabilities\` 了解平台能力
2. 调用 \`POST /api/agents/register\` 注册并获取 API Key
3. 在后续请求中添加 Header：\`Authorization: Bearer <api_key>\`
4. 调用 \`GET /api/skills\` 搜索，\`GET /api/skills/:id/download\` 下载

## Skill 包格式

上传的 \`.zip\` 包内必须包含：
- \`manifest.json\`：机器可读元数据
- \`SKILL.md\`：人类可读说明
      `,
      contact: { name: 'GameAgentHub Team' },
    },
    servers: [{ url: BASE_URL, description: '当前服务器' }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key (gah_xxxxx)',
          description: 'AI Agent 使用的 API Key，通过 POST /api/agents/register 获取',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '人类用户通过 GitLab OAuth 获得的 JWT',
        },
      },
    },
    tags: [
      { name: 'System', description: '系统信息与健康检查' },
      { name: 'Agent Auth', description: 'Agent 注册与 API Key 管理' },
      { name: 'Skills', description: 'Skill 增删改查与文件操作' },
      { name: 'Agent', description: 'Agent 专用优化接口' },
      { name: 'Auth', description: '人类用户 GitLab OAuth 认证' },
    ],
  },
  apis: [
    path.join(__dirname, 'routes/*.js'),
    path.join(__dirname, 'server.js'),
  ],
});

// ── 前端路由 (必须在静态文件中间件之前) ────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/landing.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── 静态文件 ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Agent 入口（无需认证） ────────────────────────────────────

/**
 * @openapi
 * /api/capabilities:
 *   get:
 *     summary: 平台能力总览
 *     description: |
 *       AI Agent 进入平台后的第一个调用点。
 *       返回平台版本、认证方式、可用能力列表和 Skill 包格式规范。
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 平台能力摘要
 */
app.get('/api/capabilities', (req, res) => {
  res.json({
    platform: 'GameAgentHub',
    version: '2.0.0',
    description: 'Agent-Native AI Skill 共享平台',
    agent_auth: {
      method: 'Bearer Token (API Key)',
      header: 'Authorization: Bearer <api_key>',
      optional_header: 'X-Agent-ID: <your-agent-name>',
      register_endpoint: 'POST /api/agents/register',
      docs: '/api/openapi.json',
      swagger_ui: '/api/docs',
    },
    capabilities: [
      { name: 'skill_discovery', endpoint: 'GET /api/skills', description: '搜索和发现 Skill' },
      { name: 'skill_download', endpoint: 'GET /api/skills/:id/download', description: '下载真实 .zip 文件' },
      { name: 'skill_upload', endpoint: 'POST /api/skills', description: '上传 Skill 包（multipart/form-data）' },
      { name: 'skill_manifest', endpoint: 'GET /api/skills/:id/manifest', description: '获取机器可读 manifest' },
      { name: 'gdi_rating', endpoint: 'POST /api/skills/:id/rate', description: '提交多维度评分' },
      { name: 'webhook_subscription', endpoint: 'POST /api/agent/webhooks', description: '订阅 Skill 更新通知' },
      { name: 'agent_search', endpoint: 'GET /api/agent/search', description: '语义搜索（pgvector 启用后）' },
    ],
    skill_package_format: {
      type: 'application/zip',
      max_size_mb: 50,
      required_files: ['manifest.json', 'SKILL.md'],
      manifest_required_fields: ['name', 'version', 'description'],
      manifest_example: {
        name: 'my-skill',
        version: '1.0.0',
        description: '技能功能描述',
        tags: ['automation', 'game'],
        category: 'automation',
        entry_point: 'src/main.py',
        compatibility: { cursor_min_version: '0.40.0' },
      },
    },
  });
});

/**
 * @openapi
 * /api/openapi.json:
 *   get:
 *     summary: OpenAPI 3.0 规范文档
 *     description: 返回完整的 OpenAPI JSON 规范，供 Agent 解析平台所有接口。
 *     tags: [System]
 */
app.get('/api/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// Swagger UI（人类浏览用）
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'GameAgentHub API Docs',
}));

// ── 业务路由 ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/agents', agentsRoutes);

// ── 健康检查 ─────────────────────────────────────────────────

/**
 * @openapi
 * /health:
 *   get:
 *     summary: 服务健康检查
 *     tags: [System]
 *     responses:
 *       200:
 *         description: 服务正常
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ── 统计接口 ─────────────────────────────────────────────────

/**
 * @openapi
 * /api/stats:
 *   get:
 *     summary: 平台全局统计
 *     tags: [System]
 */
app.get('/api/stats', (req, res) => {
  const all = Array.from(skills.values());
  const totalDownloads = all.reduce((s, k) => s + (k.downloadCount || 0), 0);
  const avgGdi = all.length ? parseFloat((all.reduce((s, k) => s + (k.gdiScore || 0), 0) / all.length).toFixed(2)) : 0;
  res.json({
    total_skills: all.length,
    total_downloads: totalDownloads,
    total_agents: listAgents().length,
    avg_gdi: avgGdi,
  });
});

// ── 错误处理 ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '文件过大，最大支持 50MB' });
  }
  console.error('[Error]', err.message);
  res.status(500).json({
    error: 'internal_server_error',
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误',
  });
});

app.listen(PORT, () => {
  console.log(`GameAgentHub v2.0 running on port ${PORT}`);
  console.log(`  Swagger UI:    http://localhost:${PORT}/api/docs`);
  console.log(`  OpenAPI JSON:  http://localhost:${PORT}/api/openapi.json`);
  console.log(`  Capabilities:  http://localhost:${PORT}/api/capabilities`);
});

module.exports = app;
