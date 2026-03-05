/**
 * Skill 核心路由
 * GET    /api/skills           - 列表（搜索、过滤、分页）
 * POST   /api/skills           - 上传 Skill（multipart/form-data）
 * GET    /api/skills/:id       - 详情
 * PUT    /api/skills/:id       - 更新
 * DELETE /api/skills/:id       - 删除
 * GET    /api/skills/:id/download  - 下载 .zip 文件（真实文件流）
 * GET    /api/skills/:id/manifest  - 获取 manifest.json
 * POST   /api/skills/:id/rate  - 提交评分
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authenticate, requireScope } = require('../middleware/auth');
const { upload, computeChecksum, parseSkillPackage, UPLOADS_DIR } = require('../middleware/upload');
const GDIService = require('../services/GDIService');

const gdiService = new GDIService();
const { skills, skillFiles } = require('../store');

function getSkillById(id) {
  return skills.get(id) || null;
}

/**
 * @openapi
 * /api/skills:
 *   get:
 *     summary: 获取 Skill 列表
 *     description: 支持关键词搜索、标签过滤、GDI 评分排序。Agent 可直接调用。
 *     tags: [Skills]
 *     parameters:
 *       - { in: query, name: q, schema: { type: string }, description: 搜索关键词 }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: tags, schema: { type: string }, description: 逗号分隔的标签 }
 *       - { in: query, name: min_gdi, schema: { type: number } }
 *       - { in: query, name: status, schema: { type: string, enum: [candidate, promoted, high-quality, featured] } }
 *       - { in: query, name: sort, schema: { type: string, enum: [gdi, downloads, updated, created], default: gdi } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       200:
 *         description: 成功
 */
router.get('/', authenticate(false), (req, res) => {
  const {
    q, category, tags, min_gdi, status,
    sort = 'gdi', order = 'desc',
    page = 1, limit = 20,
  } = req.query;

  let results = Array.from(skills.values());

  // 关键词过滤
  if (q) {
    const query = q.toLowerCase();
    results = results.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query) ||
      (s.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }

  if (category) {
    results = results.filter(s => s.category === category);
  }

  if (tags) {
    const tagList = tags.split(',').map(t => t.trim().toLowerCase());
    results = results.filter(s =>
      tagList.every(t => (s.tags || []).map(x => x.toLowerCase()).includes(t))
    );
  }

  if (min_gdi) {
    results = results.filter(s => s.gdiScore >= parseFloat(min_gdi));
  }

  if (status) {
    results = results.filter(s => s.status === status);
  }

  // 排序
  const sortField = { gdi: 'gdiScore', downloads: 'downloadCount', updated: 'updatedAt', created: 'createdAt' }[sort] || 'gdiScore';
  results.sort((a, b) => {
    const va = a[sortField] ?? 0;
    const vb = b[sortField] ?? 0;
    return order === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  // 分页
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const total = results.length;
  const items = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    skills: items,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

/**
 * @openapi
 * /api/skills:
 *   post:
 *     summary: 上传新 Skill
 *     description: |
 *       上传 .zip 格式的 Skill 包。包内必须包含 manifest.json 和 SKILL.md。
 *       平台自动从 manifest.json 提取元数据，无需重复填写。
 *     tags: [Skills]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Skill .zip 包
 *               name:
 *                 type: string
 *                 description: 覆盖 manifest.json 中的名称（可选）
 *               description:
 *                 type: string
 *                 description: 覆盖 manifest.json 中的描述（可选）
 */
router.post('/',
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

    // 用表单字段覆盖 manifest 中的值（可选）
    const name = (req.body.name || manifest.name).trim();
    const description = req.body.description || manifest.description;

    // 检查名称唯一性
    const existing = Array.from(skills.values()).find(s => s.name === name);
    if (existing) {
      // 已存在同名 Skill，视为新版本
      return handleNewVersion(req, res, existing, filePath, manifest);
    }

    const skillId = crypto.randomUUID();
    const checksum = computeChecksum(filePath);

    const skill = {
      id: skillId,
      name,
      description,
      authorId: req.identity.userId || req.identity.agentId,
      authorType: req.identity.type,
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

    const fileRecord = {
      id: crypto.randomUUID(),
      skillId,
      version: manifest.version,
      storagePath: filePath,
      originalFilename: req.file.originalname,
      checksumSha256: checksum,
      fileSize: req.file.size,
      manifest,
      uploadedBy: req.identity.userId || req.identity.agentId,
      createdAt: new Date().toISOString(),
    };

    skillFiles.set(skillId, [fileRecord]);

    res.status(201).json({
      success: true,
      skill_id: skillId,
      name,
      version: manifest.version,
      message: 'Skill 上传成功',
    });
  }
);

function handleNewVersion(req, res, skill, filePath, manifest) {
  const checksum = computeChecksum(filePath);
  const fileRecord = {
    id: crypto.randomUUID(),
    skillId: skill.id,
    version: manifest.version,
    storagePath: filePath,
    originalFilename: path.basename(filePath),
    checksumSha256: checksum,
    fileSize: fs.statSync(filePath).size,
    manifest,
    uploadedBy: req.identity.userId || req.identity.agentId,
    createdAt: new Date().toISOString(),
  };

  const files = skillFiles.get(skill.id) || [];
  files.push(fileRecord);
  skillFiles.set(skill.id, files);

  skill.latestVersion = manifest.version;
  skill.updatedAt = new Date().toISOString();

  res.status(201).json({
    success: true,
    skill_id: skill.id,
    name: skill.name,
    version: manifest.version,
    message: '新版本发布成功',
  });
}

/**
 * @openapi
 * /api/skills/{id}:
 *   get:
 *     summary: 获取 Skill 详情
 *     tags: [Skills]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 */
router.get('/:id', authenticate(false), (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const files = skillFiles.get(skill.id) || [];
  const latestFile = files[files.length - 1];

  res.json({
    skill: {
      ...skill,
      versions: files.map(f => f.version),
      manifest: latestFile?.manifest || null,
      download_url: `/api/skills/${skill.id}/download`,
    },
  });
});

/**
 * @openapi
 * /api/skills/{id}/download:
 *   get:
 *     summary: 下载 Skill .zip 文件
 *     description: 返回真实的 zip 二进制文件流。Agent 可直接下载使用。
 *     tags: [Skills]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: version, schema: { type: string }, description: 指定版本（默认最新）}
 */
router.get('/:id/download', authenticate(false), (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const files = skillFiles.get(skill.id) || [];
  if (!files.length) return res.status(404).json({ error: '暂无可下载的文件' });

  let fileRecord = files[files.length - 1];
  if (req.query.version) {
    fileRecord = files.find(f => f.version === req.query.version);
    if (!fileRecord) return res.status(404).json({ error: `版本 ${req.query.version} 不存在` });
  }

  if (!fs.existsSync(fileRecord.storagePath)) {
    return res.status(404).json({ error: '文件已被移除' });
  }

  // 记录下载
  skill.downloadCount = (skill.downloadCount || 0) + 1;

  const filename = `${skill.name}-v${fileRecord.version}.zip`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('X-Checksum-SHA256', fileRecord.checksumSha256);
  res.setHeader('X-Skill-Version', fileRecord.version);

  fs.createReadStream(fileRecord.storagePath).pipe(res);
});

/**
 * @openapi
 * /api/skills/{id}/manifest:
 *   get:
 *     summary: 获取 Skill manifest.json 内容
 *     description: 返回机器可读的 manifest 数据，Agent 用于了解 Skill 详情。
 *     tags: [Skills]
 */
router.get('/:id/manifest', authenticate(false), (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const files = skillFiles.get(skill.id) || [];
  const fileRecord = files[files.length - 1];
  if (!fileRecord?.manifest) return res.status(404).json({ error: '未找到 manifest 数据' });

  res.json(fileRecord.manifest);
});

/**
 * @openapi
 * /api/skills/{id}/rate:
 *   post:
 *     summary: 提交 Skill 评分
 *     tags: [Skills]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 */
router.post('/:id/rate', authenticate(), requireScope('write'), (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const { intrinsic_quality, usage_metrics, social_signals, freshness, comment } = req.body;

  const dims = {
    intrinsicQuality: parseFloat(intrinsic_quality) || 0.5,
    usageMetrics: parseFloat(usage_metrics) || 0.3,
    socialSignals: parseFloat(social_signals) || 0.3,
    freshness: parseFloat(freshness) || 0.8,
  };

  const newGdi = gdiService.calculateFromDimensions(dims);

  // 加权平均更新 GDI
  const count = skill.ratingCount || 0;
  skill.gdiScore = (skill.gdiScore * count + newGdi) / (count + 1);
  skill.ratingCount = count + 1;
  skill.status = gdiService.getStatus(skill.gdiScore);
  skill.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    new_gdi_score: parseFloat(skill.gdiScore.toFixed(4)),
    status: skill.status,
  });
});

/**
 * @openapi
 * /api/skills/{id}:
 *   delete:
 *     summary: 删除 Skill
 *     tags: [Skills]
 */
router.delete('/:id', authenticate(), requireScope('write'), (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Skill 不存在' });

  const isOwner = skill.authorId === (req.identity.userId || req.identity.agentId);
  const isAdmin = req.identity.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: '只有作者或管理员可以删除 Skill' });
  }

  // 删除文件
  const files = skillFiles.get(skill.id) || [];
  files.forEach(f => {
    if (fs.existsSync(f.storagePath)) fs.unlinkSync(f.storagePath);
  });

  skills.delete(skill.id);
  skillFiles.delete(skill.id);

  res.json({ success: true, message: `Skill ${skill.name} 已删除` });
});

module.exports = router;
