// GitLab Integration Configuration
const gitlabConfig = {
  // GitLab OAuth settings
  oauth: {
    clientId: process.env.GITLAB_CLIENT_ID || 'your-gitlab-client-id',
    clientSecret: process.env.GITLAB_CLIENT_SECRET || 'your-gitlab-client-secret',
    redirectUri: process.env.GITLAB_REDIRECT_URI || 'http://localhost:3000/auth/gitlab/callback',
    scope: 'api read_user'
  },
  
  // GitLab API settings
  api: {
    baseUrl: process.env.GITLAB_API_URL || 'https://git.game.netease.com/api/v4',
    webhookSecret: process.env.GITLAB_WEBHOOK_SECRET || 'your-webhook-secret'
  },
  
  // Internal GitLab instance
  internal: {
    enabled: true,
    domain: 'git.game.netease.com'
  }
};

module.exports = gitlabConfig;