/**
 * Agent 注册与管理路由
 * POST /api/agents/register  - 注册新 Agent（无需认证）
 * GET  /api/agents/me        - 获取当前 Agent 信息
 * POST /api/agents/rotate-key - 轮换 API Key
 * GET  /api/agents           - 列出所有 Agent（管理员）
 * DELETE /api/agents/:id     - 吊销 Agent（管理员）
 */

const express = require('express');
const router = express.Router();
const { authenticate, registerAgent, revokeAgent, listAgents } = require('../middleware/auth');

/**
 * @openapi
 * /api/agents/register:
 *   post:
 *     summary: 注册新 Agent，获取 API Key
 *     description: AI Agent 调用此接口注册身份，获得 API Key。明文 Key 仅返回一次，请妥善保存。
 *     tags: [Agent Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agent_name]
 *             properties:
 *               agent_name:
 *                 type: string
 *                 example: cursor-agent-xiaoyu
 *               owner_email:
 *                 type: string
 *                 example: user@example.com
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, write]
 *                 default: [read]
 *               expires_in_days:
 *                 type: integer
 *                 example: 90
 *     responses:
 *       201:
 *         description: 注册成功，返回 API Key（仅此一次）
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agent_id:
 *                   type: string
 *                 api_key:
 *                   type: string
 *                   example: gah_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *                 expires_at:
 *                   type: string
 *                   nullable: true
 *                 warning:
 *                   type: string
 */
router.post('/register', (req, res) => {
  const { agent_name, owner_email, scopes, expires_in_days } = req.body;

  if (!agent_name || typeof agent_name !== 'string' || !agent_name.trim()) {
    return res.status(400).json({ error: 'agent_name 是必填项' });
  }

  const result = registerAgent({
    agentName: agent_name.trim(),
    ownerEmail: owner_email,
    scopes: scopes || ['read'],
    expiresInDays: expires_in_days,
  });

  res.status(201).json({
    agent_id: result.agentId,
    api_key: result.apiKey,
    expires_at: result.expiresAt,
    warning: result.warning,
  });
});

/**
 * @openapi
 * /api/agents/me:
 *   get:
 *     summary: 获取当前 Agent 信息
 *     tags: [Agent Auth]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/me', authenticate(), (req, res) => {
  const { identity } = req;

  if (identity.type !== 'agent') {
    return res.status(400).json({ error: '此接口仅供 Agent 使用' });
  }

  res.json({
    agent_id: identity.agentId,
    agent_name: identity.agentName,
    scopes: identity.scopes,
  });
});

/**
 * @openapi
 * /api/agents:
 *   get:
 *     summary: 列出所有注册的 Agent（管理员）
 *     tags: [Agent Auth]
 *     security:
 *       - BearerAuth: []
 */
router.get('/', authenticate(), (req, res) => {
  if (req.identity?.role !== 'admin' && req.identity?.type !== 'agent') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  res.json({ agents: listAgents() });
});

/**
 * @openapi
 * /api/agents/{id}:
 *   delete:
 *     summary: 吊销 Agent（管理员）
 *     tags: [Agent Auth]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
router.delete('/:id', authenticate(), (req, res) => {
  if (req.identity?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  const revoked = revokeAgent(req.params.id);
  if (!revoked) {
    return res.status(404).json({ error: 'Agent 不存在' });
  }
  res.json({ success: true, message: `Agent ${req.params.id} 已吊销` });
});

module.exports = router;
