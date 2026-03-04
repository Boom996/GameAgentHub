// GitLab OAuth Authentication Routes
const express = require('express');
const router = express.Router();
const gitlabConfig = require('../config/gitlab');

// In-memory user storage
let users = [];

// GET /auth/gitlab - Initiate GitLab OAuth flow
router.get('/gitlab', (req, res) => {
  const oauthUrl = `${gitlabConfig.oauth.baseUrl}/oauth/authorize?` +
    `client_id=${gitlabConfig.oauth.clientId}&` +
    `redirect_uri=${gitlabConfig.oauth.redirectUri}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(gitlabConfig.oauth.scope)}`;
  
  res.json({
    success: true,
    oauthUrl: oauthUrl,
    message: 'Redirect to this URL to authenticate with GitLab'
  });
});

// GET /auth/gitlab/callback - OAuth callback
router.get('/gitlab/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code required'
    });
  }
  
  try {
    // Exchange code for token (simulated)
    const tokenResponse = await exchangeCodeForToken(code);
    
    // Get user info from GitLab
    const userInfo = await getUserInfo(tokenResponse.access_token);
    
    // Create or update user
    let user = users.find(u => u.gitlabId === userInfo.id);
    
    if (!user) {
      user = {
        id: `user_${Date.now()}`,
        gitlabId: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        avatarUrl: userInfo.avatar_url,
        role: 'user',
        createdAt: new Date(),
        lastLoginAt: new Date()
      };
      users.push(user);
    } else {
      user.lastLoginAt = new Date();
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token: tokenResponse.access_token,
      message: 'Authentication successful'
    });
    
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Helper functions (simulated)
async function exchangeCodeForToken(code) {
  // In production, this would call GitLab's OAuth token endpoint
  return {
    access_token: 'simulated_access_token',
    token_type: 'Bearer',
    expires_in: 7200
  };
}

async function getUserInfo(accessToken) {
  // In production, this would call GitLab's user API
  return {
    id: 'gitlab_user_123',
    username: 'ta_developer',
    email: 'developer@game.netease.com',
    avatar_url: 'https://gitlab.example.com/avatar.png'
  };
}

module.exports = router;