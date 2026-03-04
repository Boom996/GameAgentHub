// Skill Model
class Skill {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.authorId = data.authorId;
    this.gitlabRepo = data.gitlabRepo;
    this.version = data.version;
    this.tags = data.tags || [];
    this.category = data.category;
    this.gdiScore = data.gdiScore || 0;
    this.status = data.status || 'candidate'; // candidate, promoted, rejected, revoked
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.metadata = data.metadata || {};
  }
  
  // Calculate GDI score
  calculateGDIScore() {
    // This will be implemented with the full GDI algorithm
    return this.gdiScore;
  }
  
  // Validate skill structure
  validate() {
    return this.name && this.description && this.authorId;
  }
}

module.exports = Skill;