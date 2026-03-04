// GDI (Global Desirability Index) Scoring Configuration
// Inspired by Evomap's multi-dimensional scoring system

const gdiConfig = {
  // Weight distribution for GDI calculation
  weights: {
    intrinsicQuality: 0.35,    // 35% - Code quality, documentation, structure
    usageMetrics: 0.30,       // 30% - Downloads, installations, active usage
    socialSignals: 0.20,      // 20% - Ratings, reviews, community feedback  
    freshness: 0.15           // 15% - Recent updates, maintenance activity
  },
  
  // Scoring thresholds
  thresholds: {
    promotion: 0.7,           // Minimum GDI score for promotion to marketplace
    highQuality: 0.85,        // High-quality badge threshold
    featured: 0.9             // Featured skill threshold
  },
  
  // Intrinsic Quality dimensions
  intrinsicQuality: {
    codeQuality: {
      weight: 0.4,
      metrics: ['syntax', 'structure', 'bestPractices']
    },
    documentation: {
      weight: 0.3, 
      metrics: ['readmeCompleteness', 'apiDocs', 'examples']
    },
    functionality: {
      weight: 0.3,
      metrics: ['coreFeatures', 'errorHandling', 'edgeCases']
    }
  },
  
  // Usage Metrics dimensions  
  usageMetrics: {
    installationCount: { weight: 0.4 },
    activeUsage: { weight: 0.3 },
    retentionRate: { weight: 0.3 }
  },
  
  // Social Signals dimensions
  socialSignals: {
    averageRating: { weight: 0.5 },
    reviewCount: { weight: 0.3 },
    communityEngagement: { weight: 0.2 }
  },
  
  // Freshness dimensions
  freshness: {
    lastUpdate: { weight: 0.6 },
    maintenanceActivity: { weight: 0.4 }
  },
  
  // Anti-gaming measures
  antiGaming: {
    rateLimiting: true,
    anomalyDetection: true,
    validationRequired: true
  }
};

module.exports = gdiConfig;