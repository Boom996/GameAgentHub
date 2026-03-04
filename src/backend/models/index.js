// Database Models for GameAgentHub

const models = {
  // User model (GitLab integration)
  User: {
    id: 'string',
    gitlabId: 'string',
    username: 'string', 
    email: 'string',
    avatarUrl: 'string',
    role: 'string', // admin, moderator, user
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },
  
  // Skill model
  Skill: {
    id: 'string',
    name: 'string',
    description: 'string',
    ownerId: 'string', // references User.id
    latestVersionId: 'string',
    tags: 'object', // { tag -> versionId }
    gdiScore: 'number',
    status: 'string', // active, hidden, removed
    stats: 'object', // { downloads, stars, versions, comments }
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
  },
  
  // Skill Version model  
  SkillVersion: {
    id: 'string',
    skillId: 'string', // references Skill.id
    version: 'string', // semver
    tag: 'string', // optional
    changelog: 'string',
    files: 'array', // file metadata
    parsed: 'object', // from SKILL.md
    vectorDocId: 'string', // for vector search
    createdBy: 'string', // references User.id
    createdAt: 'timestamp',
    softDeletedAt: 'timestamp'
  },
  
  // Rating model (GDI multi-dimensional)
  Rating: {
    id: 'string',
    skillId: 'string',
    userId: 'string',
    overallScore: 'number', // 1-5 stars
    dimensions: 'object', // { intrinsicQuality, usageMetrics, socialSignals, freshness }
    comment: 'string',
    createdAt: 'timestamp'
  },
  
  // Installation model
  Installation: {
    id: 'string', 
    skillId: 'string',
    userId: 'string',
    version: 'string',
    installedAt: 'timestamp'
  }
};

module.exports = models;