/**
 * GDI（Global Desirability Index）评分服务
 * 多维度综合评分：内在质量(35%) + 使用指标(30%) + 社交信号(20%) + 新鲜度(15%)
 */

class GDIService {
  constructor() {
    this.weights = {
      intrinsicQuality: 0.35,
      usageMetrics: 0.30,
      socialSignals: 0.20,
      freshness: 0.15,
    };
  }

  /**
   * 从各维度直接计算 GDI 分数
   * @param {object} dims - 各维度分数（均为 0-1）
   */
  calculateFromDimensions(dims) {
    const iq = Math.min(1, Math.max(0, dims.intrinsicQuality ?? 0.5));
    const um = Math.min(1, Math.max(0, dims.usageMetrics ?? 0.3));
    const ss = Math.min(1, Math.max(0, dims.socialSignals ?? 0.3));
    const fr = Math.min(1, Math.max(0, dims.freshness ?? 0.8));

    return (
      iq * this.weights.intrinsicQuality +
      um * this.weights.usageMetrics +
      ss * this.weights.socialSignals +
      fr * this.weights.freshness
    );
  }

  /**
   * 从 Skill 统计数据推导 GDI 分数
   * @param {object} skill
   */
  calculateFromSkill(skill) {
    const hasManifest = !!skill.manifest;
    const intrinsicQuality = hasManifest ? 0.8 : 0.5;

    const downloadCount = skill.downloadCount || 0;
    const usageMetrics = Math.min(1, downloadCount / 100);

    const avgRating = skill.averageRating || 0;
    const socialSignals = avgRating / 5;

    const updatedAt = skill.updatedAt ? new Date(skill.updatedAt) : new Date();
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const freshness = Math.max(0, 1 - daysSinceUpdate / 90);

    return this.calculateFromDimensions({
      intrinsicQuality,
      usageMetrics,
      socialSignals,
      freshness,
    });
  }

  /**
   * 根据 GDI 分数返回状态标签
   */
  getStatus(gdiScore) {
    if (gdiScore >= 0.90) return 'featured';
    if (gdiScore >= 0.80) return 'high-quality';
    if (gdiScore >= 0.65) return 'promoted';
    return 'candidate';
  }

  /**
   * 返回各维度的分解说明（用于展示给开发者）
   */
  explain(skill) {
    const score = this.calculateFromSkill(skill);
    return {
      overall: parseFloat(score.toFixed(4)),
      status: this.getStatus(score),
      breakdown: {
        intrinsic_quality: { weight: '35%', description: '代码质量与文档完整性' },
        usage_metrics: { weight: '30%', description: '下载量与活跃使用情况' },
        social_signals: { weight: '20%', description: '用户评分与社区反馈' },
        freshness: { weight: '15%', description: '近期更新活跃度' },
      },
    };
  }
}

module.exports = GDIService;
