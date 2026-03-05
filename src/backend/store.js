/**
 * 共享内存数据存储（MVP阶段，后续替换为 PostgreSQL）
 * skills.js 和 agent.js 共用同一份数据
 */

const skills = new Map();
const skillFiles = new Map(); // skillId -> [fileRecord]

module.exports = { skills, skillFiles };
