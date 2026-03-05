/**
 * GitLab OAuth 认证路由（面向人类用户）
 *
 * GET  /api/auth/gitlab          - 发起 OAuth 流程（跳转浏览器）
 * GET  /api/auth/gitlab/callback - OAuth 回调，签发 JWT
 * GET  /api/auth/me              - 获取当前用户信息
 * POST /api/auth/logout          - 登出
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate, signJwt } = require('../middleware/auth');

const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID || 'your-client-id';
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET || 'your-client-secret';
const GITLAB_REDIRECT_URI = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/api/auth/gitlab/callback';
const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
const GITLAB_API_URL = `${GITLAB_BASE_URL}/api/v4`;

/**
 * @openapi
 * /api/auth/gitlab:
 *   get:
 *     summary: 发起 GitLab OAuth 登录（仅浏览器）
 *     description: 重定向到 GitLab OAuth 授权页面。AI Agent 请使用 API Key，不要调用此接口。
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: 重定向到 GitLab
 */
router.get('/gitlab', (req, res) => {
  const authUrl = `${GITLAB_BASE_URL}/oauth/authorize?` +
    `client_id=${GITLAB_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(GITLAB_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=read_user`;
  res.redirect(authUrl);
});

/**
 * @openapi
 * /api/auth/gitlab/callback:
 *   get:
 *     summary: GitLab OAuth 回调
 *     description: 交换授权码，签发 JWT，重定向回前端。
 *     tags: [Auth]
 */
router.get('/gitlab/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  try {
    const tokenResponse = await axios.post(`${GITLAB_BASE_URL}/oauth/token`, {
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GITLAB_REDIRECT_URI,
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get(`${GITLAB_API_URL}/user`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const gitlabUser = userResponse.data;

    // 构造平台用户对象（MVP 使用内存，生产替换为 DB upsert）
    const user = {
      id: `gitlab_${gitlabUser.id}`,
      username: gitlabUser.username,
      email: gitlabUser.email,
      avatarUrl: gitlabUser.avatar_url,
      role: 'user',
    };

    const jwt = signJwt(user);

    // 将 JWT 传给前端（实际生产建议用 HttpOnly Cookie）
    res.redirect(`/?token=${jwt}&username=${encodeURIComponent(user.username)}`);
  } catch (err) {
    console.error('[Auth] GitLab OAuth error:', err.message);
    res.status(500).json({ error: 'authentication_failed', message: 'GitLab 认证失败' });
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: 获取当前用户/Agent 信息
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 */
router.get('/me', authenticate(), (req, res) => {
  res.json({ identity: req.identity });
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: 登出（人类用户）
 *     tags: [Auth]
 */
router.post('/logout', (req, res) => {
  // JWT 无状态，前端直接清除 token 即可
  res.json({ success: true, message: '请在客户端清除 token' });
});

module.exports = router;
