// User Model (GitLab integration)
class User {
  constructor(data) {
    this.id = data.id;
    this.gitlabId = data.gitlabId;
    this.username = data.username;
    this.email = data.email;
    this.avatarUrl = data.avatarUrl;
    this.role = data.role || 'user'; // user, moderator, admin
    this.createdAt = data.createdAt || new Date();
    this.lastLoginAt = data.lastLoginAt || new Date();
  }
  
  // Check if user has required permissions
  hasPermission(permission) {
    const permissions = {
      upload: ['user', 'moderator', 'admin'],
      moderate: ['moderator', 'admin'],
      admin: ['admin']
    };
    
    return permissions[permission] && permissions[permission].includes(this.role);
  }
}

module.exports = User;