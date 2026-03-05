/**
 * 双轨认证中间件
 * 轨道1：GitLab OAuth JWT（人类用户）
 * 轨道2：API Key Bearer Token（AI Agent）
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// 内存中的 AgentToken 存储（MVP阶段，后续替换为 PostgreSQL）
const agentTokens = new Map();

/**
 * 生成 API Key
 * 格式：gah_<32字节随机十六进制>
 */
function generateApiKey() {
  return `gah_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * 计算 API Key 的 SHA-256 哈希（服务器只存哈希）
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * 注册新 Agent，返回 API Key（明文只返回一次）
 */
function registerAgent({ agentName, ownerEmail, scopes = ['read'], expiresInDays }) {
  const apiKey = generateApiKey();
  const tokenHash = hashApiKey(apiKey);
  const agentId = crypto.randomUUID();

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const agentRecord = {
    id: agentId,
    agentName,
    ownerEmail: ownerEmail || null,
    tokenHash,
    scopes,
    expiresAt,
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date(),
  };

  agentTokens.set(tokenHash, agentRecord);

  return {
    agentId,
    apiKey,  // 明文只在这里返回一次
    expiresAt,
    warning: '此 API Key 仅显示一次，请立即保存',
  };
}

/**
 * 通过 API Key 查找 Agent 记录
 */
function findAgentByKey(apiKey) {
  const tokenHash = hashApiKey(apiKey);
  const agent = agentTokens.get(tokenHash);
  if (!agent) return null;
  if (!agent.isActive) return null;
  if (agent.expiresAt && new Date() > agent.expiresAt) return null;

  // 更新最后使用时间
  agent.lastUsedAt = new Date();
  return agent;
}

/**
 * 吊销 Agent Token
 */
function revokeAgent(agentId) {
  for (const [hash, agent] of agentTokens) {
    if (agent.id === agentId) {
      agent.isActive = false;
      return true;
    }
  }
  return false;
}

/**
 * 列出所有 Agent
 */
function listAgents() {
  return Array.from(agentTokens.values()).map(a => ({
    ...a,
    tokenHash: undefined, // 不暴露哈希
  }));
}

/**
 * 认证中间件
 * 依次尝试：API Key → JWT Session
 * 成功后将身份挂到 req.identity = { type: 'agent'|'user', ... }
 */
function authenticate(required = true) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const agentIdHeader = req.headers['x-agent-id'];

    // 尝试 API Key 认证
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // 先尝试 API Key
      if (token.startsWith('gah_')) {
        const agent = findAgentByKey(token);
        if (agent) {
          req.identity = {
            type: 'agent',
            agentId: agent.id,
            agentName: agentIdHeader || agent.agentName,
            scopes: agent.scopes,
          };
          return next();
        }
        return res.status(401).json({
          error: 'invalid_api_key',
          message: 'API Key 无效或已过期',
        });
      }

      // 尝试 JWT（人类用户）
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.identity = {
          type: 'user',
          userId: decoded.sub,
          username: decoded.username,
          role: decoded.role,
          scopes: ['read', 'write'],
        };
        return next();
      } catch (err) {
        return res.status(401).json({
          error: 'invalid_token',
          message: 'Token 无效或已过期',
        });
      }
    }

    // 未提供认证信息
    if (required) {
      return res.status(401).json({
        error: 'authentication_required',
        message: '此接口需要认证。人类用户请使用 GitLab OAuth，Agent 请使用 API Key。',
        docs: '/api/capabilities',
      });
    }

    req.identity = null;
    next();
  };
}

/**
 * 权限检查中间件
 * 要求 identity.scopes 包含指定权限
 */
function requireScope(scope) {
  return (req, res, next) => {
    if (!req.identity) {
      return res.status(401).json({ error: 'authentication_required' });
    }
    if (!req.identity.scopes?.includes(scope) && !req.identity.scopes?.includes('admin')) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `此操作需要 ${scope} 权限`,
      });
    }
    next();
  };
}

/**
 * 签发 JWT（GitLab OAuth 成功后调用）
 */
function signJwt(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role || 'user',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticate,
  requireScope,
  registerAgent,
  findAgentByKey,
  revokeAgent,
  listAgents,
  signJwt,
};
