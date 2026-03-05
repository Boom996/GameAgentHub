/**
 * Agent 专用路由（/api/agent/*）
 * 面向 AI Agent 优化的接口，返回 Agent 直接可用的数据格式
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireScope } = require('../middleware/auth');
const { upload, computeChecksum, parseSkillPackage } = require('../middleware/upload');
const GDIService = require('../services/GDIService');
const { skills, skillFiles } = require('../store');

const gdiService = new GDIService();
const webhooks = new Map();

/**
 * @openapi
 * /api/agent/discover:
 *   get:
 *     summary: Agent Skill 发现接口
 *     description: 返回所有 Skill，附加 download_url、manifest 等 Agent 友好字段。
 *     tags: [Agent]
 */
router.get('/discover', authenticate(false), (req, res) => {
  const { q, category, min_gdi, limit = 20 } = req.query;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  let results = Array.from(skills.values());

  if (q) {
    const query = q.toLowerCase();
    results = results.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      (s.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }
  if (category) results = results.filter(s => s.category === category);
  if (min_gdi) results = results.filter(s => s.gdiScore >= parseFloat(min_gdi));

  results.sort((a, b) => b.gdiScore - a.gdiScore);
  results = results.slice(0, parseInt(limit));

  const agentSkills = results.map(s => {
    const files = skillFiles.get(s.id) || [];
    const latest = files[files.length - 1];
    return {
      ...s,
      download_url: `${baseUrl}/api/skills/${s.id}/download`,
      manifest_url: `${baseUrl}/api/skills/${s.id}/manifest`,
      manifest: latest?.manifest || null,
      checksum: latest?.checksumSha256 || null,
    };
  });

  res.json({
    platform: 'GameAgentHub',
    api_version: '2.0',
    total: agentSkills.length,
    skills: agentSkills,
    agent_tip: 'Use GET /api/skills?q=xxx for keyword search, POST /api/skills to upload.',
    docs: `${baseUrl}/api/openapi.json`,
  });
});

/**
 * @openapi
 * /api/agent/search:
 *   get:
 *     summary: Agent 语义搜索
 *     tags: [Agent]
 *     parameters:
 *       - { in: query, name: q, required: true, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 */
router.get('/search', authenticate(false), (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ error: '请提供搜索关键词 q' });

  const query = q.toLowerCase();
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  let results = Array.from(skills.values());

  const scored = results.map(s => {
    let relevance = 0;
    if (s.name.toLowerCase().includes(query)) relevance += 0.6;
    if (s.description.toLowerCase().includes(query)) relevance += 0.3;
    if ((s.tags || []).some(t => t.toLowerCase().includes(query))) relevance += 0.1;
    return { skill: s, relevance };
  }).filter(r => r.relevance > 0);

  scored.sort((a, b) => b.relevance - a.relevance);
  const top = scored.slice(0, parseInt(limit));

  res.json({
    query: q,
    search_type: 'keyword',
    total: top.length,
    results: top.map(r => {
      const files = skillFiles.get(r.skill.id) || [];
      const latest = files[files.length - 1];
      return {
        ...r.skill,
        relevance: parseFloat(r.relevance.toFixed(2)),
        download_url: `${baseUrl}/api/skills/${r.skill.id}/download`,
        manifest: latest?.manifest || null,
      };
    }),
  });
});

/**
 * @openapi
 * /api/agent/skills:
 *   post:
 *     summary: Agent 上传 Skill
 *     tags: [Agent]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/skills',
  authenticate(),
  requireScope('write'),
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: '请上传 .zip 格式的 Skill 包' });
    }

    const filePath = req.file.path;
    const { manifest, skillMd, error } = parseSkillPackage(filePath);
    if (error) {
      fs.unlinkSync(filePath);
      return res.status(422).json({ error });
    }

    const name = (req.body.name || manifest.name).trim();
    const description = req.body.description || manifest.description;
    const checksum = computeChecksum(filePath);

    const existing = Array.from(skills.values()).find(s => s.name === name);
    if (existing) {
      const fileRecord = {
        id: crypto.randomUUID(),
        skillId: existing.id,
        version: manifest.version,
        storagePath: filePath,
        originalFilename: req.file.originalname,
        checksumSha256: checksum,
        fileSize: req.file.size,
        manifest,
        uploadedBy: req.identity.agentId,
        createdAt: new Date().toISOString(),
      };
      const files = skillFiles.get(existing.id) || [];
      files.push(fileRecord);
      skillFiles.set(existing.id, files);
      existing.latestVersion = manifest.version;
      existing.updatedAt = new Date().toISOString();

      return res.status(201).json({
        success: true,
        skill_id: existing.id,
        name: existing.name,
        version: manifest.version,
        checksum,
        message: '新版本发布成功',
      });
    }

    const skillId = crypto.randomUUID();
    const skill = {
      id: skillId,
      name,
      description,
      authorId: req.identity.agentId,
      authorType: 'agent',
      latestVersion: manifest.version,
      tags: manifest.tags || [],
      category: manifest.category || 'uncategorized',
      gdiScore: 0.3,
      status: 'candidate',
      downloadCount: 0,
      ratingCount: 0,
      totalRating: 0,
      averageRating: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    skills.set(skillId, skill);

    skillFiles.set(skillId, [{
      id: crypto.randomUUID(),
      skillId,
      version: manifest.version,
      storagePath: filePath,
      originalFilename: req.file.originalname,
      checksumSha256: checksum,
      fileSize: req.file.size,
      manifest,
      uploadedBy: req.identity.agentId,
      createdAt: new Date().toISOString(),
    }]);

    res.status(201).json({
      success: true,
      skill_id: skillId,
      name,
      version: manifest.version,
      checksum,
      message: 'Skill 上传成功',
    });
  }
);

/**
 * @openapi
 * /api/agent/skills/{id}/download:
 *   get:
 *     summary: Agent 下载 Skill
 *     tags: [Agent]
 */
router.get('/skills/:id/download', authenticate(false), (req, res) => {
  res.redirect(`/api/skills/${req.params.id}/download`);
});

/**
 * @openapi
 * /api/agent/rate/{skillId}:
 *   post:
 *     summary: Agent 提交评分
 *     tags: [Agent]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/rate/:skillId', authenticate(), requireScope('write'), (req, res) => {
  const skill = skills.get(req.params.skillId);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const { intrinsic_quality, usage_metrics, social_signals, freshness, comment } = req.body;
  const dims = {
    intrinsicQuality: parseFloat(intrinsic_quality) || 0.5,
    usageMetrics: parseFloat(usage_metrics) || 0.3,
    socialSignals: parseFloat(social_signals) || 0.3,
    freshness: parseFloat(freshness) || 0.8,
  };
  const newGdi = gdiService.calculateFromDimensions(dims);
  const count = skill.ratingCount || 0;
  skill.gdiScore = (skill.gdiScore * count + newGdi) / (count + 1);
  skill.ratingCount = count + 1;
  skill.status = gdiService.getStatus(skill.gdiScore);
  skill.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    skill_id: skill.id,
    new_gdi_score: parseFloat(skill.gdiScore.toFixed(4)),
    status: skill.status,
    recorded_by: req.identity.agentId,
  });
});

/**
 * @openapi
 * /api/webhooks:
 *   post:
 *     summary: 注册 Webhook
 *     tags: [Agent]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/webhooks', authenticate(), (req, res) => {
  const { callback_url, events, skill_ids } = req.body;
  if (!callback_url) return res.status(400).json({ error: 'callback_url 是必填项' });

  const webhookId = crypto.randomUUID();
  webhooks.set(webhookId, {
    id: webhookId,
    agentId: req.identity.agentId || req.identity.userId,
    callbackUrl: callback_url,
    events: events || ['skill.updated', 'skill.created'],
    skillIds: skill_ids || [],
    isActive: true,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ webhook_id: webhookId, callback_url, events: events || ['skill.updated', 'skill.created'] });
});

/**
 * @openapi
 * /api/webhooks/{id}:
 *   delete:
 *     summary: 取消 Webhook 订阅
 *     tags: [Agent]
 */
router.delete('/webhooks/:id', authenticate(), (req, res) => {
  if (!webhooks.has(req.params.id)) return res.status(404).json({ error: 'Webhook 不存在' });
  webhooks.delete(req.params.id);
  res.json({ success: true, message: 'Webhook 已取消' });
});

module.exports = router;
