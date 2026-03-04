// GameAgentHub API Routes
// Agent-friendly RESTful API for skill management
const express = require('express');
const router = express.Router();
const gdiConfig = require('../config/gdi');

// In-memory storage (will be replaced with database)
let skills = [];
let users = [];

// ============ Skill Discovery Endpoints ============

// GET /api/skills - List all skills (Agent-friendly)
router.get('/skills', (req, res) => {
  const { tag, category, search, sort = 'gdiScore', limit = 20 } = req.query;
  
  let filteredSkills = [...skills];
  
  // Filter by tag
  if (tag) {
    filteredSkills = filteredSkills.filter(s => s.tags.includes(tag));
  }
  
  // Filter by category
  if (category) {
    filteredSkills = filteredSkills.filter(s => s.category === category);
  }
  
  // Search by name/description
  if (search) {
    const searchLower = search.toLowerCase();
    filteredSkills = filteredSkills.filter(s => 
      s.name.toLowerCase().includes(searchLower) ||
      s.description.toLowerCase().includes(searchLower)
    );
  }
  
  // Sort
  filteredSkills.sort((a, b) => {
    if (sort === 'gdiScore') return b.gdiScore - a.gdiScore;
    if (sort === 'createdAt') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === 'downloads') return b.stats.downloads - a.stats.downloads;
    return 0;
  });
  
  // Limit results
  filteredSkills = filteredSkills.slice(0, parseInt(limit));
  
  res.json({
    success: true,
    skills: filteredSkills,
    total: filteredSkills.length,
    metadata: {
      timestamp: new Date().toISOString(),
      query: { tag, category, search, sort, limit }
    }
  });
});

// GET /api/skills/:id - Get skill details
router.get('/skills/:id', (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  
  if (!skill) {
    return res.status(404).json({
      success: false,
      error: 'Skill not found'
    });
  }
  
  res.json({
    success: true,
    skill: skill,
    gdiBreakdown: calculateGDIBreakdown(skill)
  });
});

// POST /api/skills - Upload new skill (Agent-friendly)
router.post('/skills', (req, res) => {
  const { name, description, authorId, gitlabRepo, version, tags, category, files } = req.body;
  
  // Validate required fields
  if (!name || !description || !authorId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, description, authorId'
    });
  }
  
  const newSkill = {
    id: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    authorId,
    gitlabRepo: gitlabRepo || null,
    version: version || '1.0.0',
    tags: tags || [],
    category: category || 'uncategorized',
    gdiScore: 0, // Will be calculated after validation
    status: 'candidate',
    stats: {
      downloads: 0,
      installations: 0,
      ratings: 0,
      averageRating: 0
    },
    files: files || [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  skills.push(newSkill);
  
  res.status(201).json({
    success: true,
    skill: newSkill,
    message: 'Skill uploaded successfully. Awaiting validation.'
  });
});

// POST /api/skills/:id/install - Install skill (Agent-friendly)
router.post('/skills/:id/install', (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  
  if (!skill) {
    return res.status(404).json({
      success: false,
      error: 'Skill not found'
    });
  }
  
  // Update stats
  skill.stats.installations++;
  skill.updatedAt = new Date();
  
  res.json({
    success: true,
    message: `Skill "${skill.name}" installed successfully`,
    skill: {
      id: skill.id,
      name: skill.name,
      version: skill.version
    },
    installationId: `install_${Date.now()}`
  });
});

// POST /api/skills/:id/rate - Rate skill with GDI multi-dimensional scoring
router.post('/skills/:id/rate', (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  const { userId, overallScore, dimensions, comment } = req.body;
  
  if (!skill) {
    return res.status(404).json({
      success: false,
      error: 'Skill not found'
    });
  }
  
  if (!overallScore || overallScore < 1 || overallScore > 5) {
    return res.status(400).json({
      success: false,
      error: 'Invalid score. Must be between 1 and 5'
    });
  }
  
  // Update skill rating stats
  const totalRatings = skill.stats.ratings;
  const currentAverage = skill.stats.averageRating;
  
  skill.stats.ratings++;
  skill.stats.averageRating = ((currentAverage * totalRatings) + overallScore) / (totalRatings + 1);
  
  // Recalculate GDI score
  skill.gdiScore = calculateGDIScore(skill, dimensions);
  skill.updatedAt = new Date();
  
  res.json({
    success: true,
    message: 'Rating submitted successfully',
    newGDIScore: skill.gdiScore,
    newAverageRating: skill.stats.averageRating
  });
});

// ============ Utility Functions ============

function calculateGDIScore(skill, dimensions) {
  // Simplified GDI calculation based on Evomap's approach
  const weights = gdiConfig.weights;
  
  // Intrinsic quality (from dimensions or default)
  const intrinsicQuality = dimensions?.intrinsicQuality || 0.5;
  
  // Usage metrics (from stats)
  const usageMetrics = Math.min(1, skill.stats.installations / 100);
  
  // Social signals (from ratings)
  const socialSignals = skill.stats.averageRating / 5;
  
  // Freshness (based on update time)
  const daysSinceUpdate = (new Date() - new Date(skill.updatedAt)) / (1000 * 60 * 60 * 24);
  const freshness = Math.max(0, 1 - (daysSinceUpdate / 90)); // Decay over 90 days
  
  // Calculate weighted GDI score
  const gdiScore = 
    (intrinsicQuality * weights.intrinsicQuality) +
    (usageMetrics * weights.usageMetrics) +
    (socialSignals * weights.socialSignals) +
    (freshness * weights.freshness);
  
  return Math.round(gdiScore * 100) / 100;
}

function calculateGDIBreakdown(skill) {
  return {
    intrinsicQuality: 0.5, // Placeholder
    usageMetrics: Math.min(1, skill.stats.installations / 100),
    socialSignals: skill.stats.averageRating / 5,
    freshness: 0.8, // Placeholder
    total: skill.gdiScore
  };
}

// ============ Agent Discovery Endpoint ============

// GET /api/agent/discover - Agent-friendly skill discovery
router.get('/agent/discover', (req, res) => {
  const { capabilities, requirements } = req.query;
  
  // Find skills matching agent capabilities
  let matchingSkills = skills.filter(s => s.status === 'candidate' || s.status === 'promoted');
  
  if (capabilities) {
    const caps = capabilities.split(',');
    matchingSkills = matchingSkills.filter(s => 
      caps.some(cap => s.tags.includes(cap) || s.name.toLowerCase().includes(cap.toLowerCase()))
    );
  }
  
  res.json({
    success: true,
    recommendedSkills: matchingSkills.slice(0, 10),
    totalAvailable: matchingSkills.length,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;