# 🎮 GameAgentHub

**网易游戏 TA 团队内部 AI 技能共享平台**

一个对标 ClawHub、融合 Evomap GDI 评分机制、具备 PC Agent Loop 自动化特性的内部 AI 技能共享平台。

---

## ✨ 核心特性

### 🤖 Agent 友好
- 完整的 REST API 支持 Agent 自主操作
- 自动化技能发现、安装、更新
- JSON 格式响应，易于集成

### 🔗 GitLab 深度集成
- OAuth 2.0 认证
- Webhook 事件同步
- 仓库管理自动化

### 📊 GDI 多维度评分
借鉴 Evomap 的 Global Desirability Index：
- **内在质量 (35%)**: 代码质量、文档完整性、功能完整性
- **使用指标 (30%)**: 安装量、活跃度、留存率
- **社交信号 (20%)**: 评分、评论、社区参与
- **新鲜度 (15%)**: 最近更新、维护活动

### 🚀 自动化工作流
- 技能自动验证
- 质量门禁检查
- 持续集成/部署

---

## 🏃 快速开始

### 前置要求
- Node.js >= 16.x
- npm >= 8.x
- (可选) PostgreSQL >= 14
- (可选) Redis >= 6

### 安装

```bash
# 克隆项目
cd ~/AIProject/GameAgentHub

# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env
# 编辑 .env 文件配置 GitLab 等信息

# 启动服务
npm start
```

### 访问

- **前端界面**: http://localhost:3000
- **API 端点**: http://localhost:3000/api
- **健康检查**: http://localhost:3000/health

---

## 📡 API 文档

### 技能管理

#### 获取技能列表
```bash
GET /api/skills?tag=ai&category=3d&search=export&sort=gdiScore&limit=20
```

#### 获取技能详情
```bash
GET /api/skills/:id
```

#### 上传新技能
```bash
POST /api/skills
Content-Type: application/json

{
  "name": "技能名称",
  "description": "技能描述",
  "authorId": "作者 ID",
  "version": "1.0.0",
  "tags": ["tag1", "tag2"],
  "category": "分类"
}
```

#### 安装技能
```bash
POST /api/skills/:id/install
```

#### 评分技能（GDI 多维度）
```bash
POST /api/skills/:id/rate
Content-Type: application/json

{
  "userId": "用户 ID",
  "overallScore": 4,
  "dimensions": {
    "intrinsicQuality": 0.85,
    "usageMetrics": 0.7,
    "socialSignals": 0.9,
    "freshness": 0.8
  }
}
```

### Agent 专用接口

#### 技能发现
```bash
GET /api/agent/discover?capabilities=ai,automation,3d
```

### 认证

#### GitLab OAuth
```bash
GET /auth/gitlab
GET /auth/gitlab/callback?code=AUTH_CODE
```

---

## 🏗️ 技术架构

### 后端
- **框架**: Express.js (Node.js)
- **数据库**: PostgreSQL (计划)
- **缓存**: Redis (计划)
- **认证**: GitLab OAuth 2.0

### 前端
- **框架**: 原生 HTML/CSS/JavaScript
- **样式**: 自定义 CSS + 渐变主题
- **交互**: Fetch API + 异步加载

### 部署
- **容器**: Docker (计划)
- **编排**: Kubernetes (计划)
- **环境**: 网易内部集群

---

## 📊 GDI 评分系统

### 评分维度权重

| 维度 | 权重 | 说明 |
|------|------|------|
| 内在质量 | 35% | 代码质量、文档、功能完整性 |
| 使用指标 | 30% | 安装量、活跃度、留存率 |
| 社交信号 | 20% | 评分、评论、社区参与 |
| 新鲜度 | 15% | 最近更新、维护活动 |

### 评分阈值

- **推广门槛**: GDI ≥ 0.7
- **高质量徽章**: GDI ≥ 0.85
- **精选技能**: GDI ≥ 0.9

### 防刷机制

- 速率限制
- 异常检测
- 验证必需
- 人工审核

---

## 🧪 测试

```bash
# 运行 API 测试脚本
bash test-api.sh

# 运行单元测试
npm test
```

---

## 📁 项目结构

```
GameAgentHub/
├── src/
│   ├── backend/
│   │   ├── server.js          # 主服务器
│   │   ├── routes/
│   │   │   ├── api.js         # API 路由
│   │   │   └── auth.js        # 认证路由
│   │   ├── models/            # 数据模型
│   │   └── config/            # 配置文件
│   └── frontend/
│       └── index.html         # 前端页面
├── package.json
├── README.md
├── DEVELOPMENT_PLAN.md        # 开发计划
├── PROGRESS_REPORT.md         # 进度报告
└── test-api.sh                # 测试脚本
```

---

## 🔧 配置

### 环境变量

```bash
# 服务器配置
PORT=3000

# GitLab OAuth
GITLAB_CLIENT_ID=your-client-id
GITLAB_CLIENT_SECRET=your-client-secret
GITLAB_REDIRECT_URI=http://localhost:3000/auth/gitlab/callback
GITLAB_API_URL=https://git.game.netease.com/api/v4

# 数据库（计划）
DATABASE_URL=postgresql://user:pass@localhost:5432/gameagenthub
REDIS_URL=redis://localhost:6379
```

---

## 📈 开发路线图

### Phase 1: MVP (当前)
- ✅ 基础 API 端点
- ✅ 前端界面
- ✅ GDI 评分系统
- 🔄 GitLab OAuth 集成

### Phase 2: 完整功能 (1-2 周)
- [ ] 数据库持久化
- [ ] 向量搜索
- [ ] 完整 GitLab 集成
- [ ] 自动化测试

### Phase 3: 高级功能 (3-4 周)
- [ ] Webhook 事件处理
- [ ] 权限系统
- [ ] 监控告警
- [ ] 性能优化

---

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

MIT License - 网易游戏 TA 团队内部使用

---

## 📞 联系方式

- **项目负责人**: 晓芸 (产品经理)
- **技术负责人**: 志远 (全栈主程)
- **团队**: 网易游戏 TA 团队

---

## 🙏 致谢

- **ClawHub**: 技能架构参考
- **Evomap**: GDI 评分机制灵感
- **PC Agent Loop**: 自动化特性借鉴

---

**最后更新**: 2026-03-04  
**版本**: 1.0.0 MVP