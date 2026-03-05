/**
 * 文件上传中间件
 * 处理 Skill .zip 包的上传、校验和解析
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname) || '.zip';
    cb(null, `skill-${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (
    file.mimetype === 'application/zip' ||
    file.mimetype === 'application/x-zip-compressed' ||
    file.originalname.endsWith('.zip')
  ) {
    cb(null, true);
  } else {
    cb(new Error('只接受 .zip 格式的 Skill 包'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/**
 * 计算文件的 SHA-256 校验和
 */
function computeChecksum(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 从 zip 包中解析 manifest.json 和 SKILL.md
 * 返回 { manifest, skillMd, error }
 */
function parseSkillPackage(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    let manifest = null;
    let skillMd = null;

    for (const entry of entries) {
      const name = path.basename(entry.entryName);
      if (name === 'manifest.json') {
        try {
          manifest = JSON.parse(entry.getData().toString('utf8'));
        } catch {
          return { error: 'manifest.json 格式错误，请确保是合法的 JSON' };
        }
      }
      if (name === 'SKILL.md') {
        skillMd = entry.getData().toString('utf8');
      }
    }

    if (!manifest) {
      return { error: 'zip 包中缺少 manifest.json 文件' };
    }
    if (!skillMd) {
      return { error: 'zip 包中缺少 SKILL.md 文件' };
    }

    // 校验 manifest 必填字段
    const required = ['name', 'version', 'description'];
    for (const field of required) {
      if (!manifest[field]) {
        return { error: `manifest.json 缺少必填字段：${field}` };
      }
    }

    return { manifest, skillMd };
  } catch (err) {
    return { error: `无法解析 zip 包：${err.message}` };
  }
}

module.exports = { upload, computeChecksum, parseSkillPackage, UPLOADS_DIR };
