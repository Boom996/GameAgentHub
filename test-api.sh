#!/bin/bash
# GameAgentHub API Test Script

API_BASE="http://localhost:3000/api"

echo "======================================"
echo "GameAgentHub API 测试"
echo "======================================"
echo ""

# Test 1: Health check
echo "1. 测试健康检查..."
curl -s "$API_BASE/../health" | python3 -m json.tool 2>/dev/null || curl -s "$API_BASE/../health"
echo ""

# Test 2: Upload skill 1
echo "2. 上传示例技能 1..."
curl -s -X POST "$API_BASE/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FBX 批量导出工具",
    "description": "Maya 中一键批量导出 FBX，支持自定义命名规则和贴图检测",
    "authorId": "ta_user_001",
    "version": "2.3.1",
    "tags": ["3d", "export", "maya", "fbx"],
    "category": "3d-modeling"
  }' | python3 -m json.tool 2>/dev/null
echo ""

# Test 3: Upload skill 2
echo "3. 上传示例技能 2..."
curl -s -X POST "$API_BASE/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PBR 材质生成器",
    "description": "基于 AI 的 PBR 材质自动生成工具，支持多种风格",
    "authorId": "ta_user_002",
    "version": "1.5.0",
    "tags": ["ai", "pbr", "material", "texture"],
    "category": "material-system"
  }' | python3 -m json.tool 2>/dev/null
echo ""

# Test 4: Upload skill 3
echo "4. 上传示例技能 3..."
curl -s -X POST "$API_BASE/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "动画重定向工具",
    "description": "自动在不同角色之间重定向动画，保持运动学完整性",
    "authorId": "ta_user_003",
    "version": "3.0.2",
    "tags": ["animation", "retargeting", "maya"],
    "category": "animation"
  }' | python3 -m json.tool 2>/dev/null
echo ""

# Test 5: List all skills
echo "5. 获取所有技能列表..."
curl -s "$API_BASE/skills" | python3 -m json.tool 2>/dev/null
echo ""

# Test 6: Install a skill
echo "6. 测试安装技能..."
SKILL_ID=$(curl -s "$API_BASE/skills" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$SKILL_ID" ]; then
  curl -s -X POST "$API_BASE/skills/$SKILL_ID/install" | python3 -m json.tool 2>/dev/null
fi
echo ""

# Test 7: Rate a skill
echo "7. 测试评分技能..."
if [ -n "$SKILL_ID" ]; then
  curl -s -X POST "$API_BASE/skills/$SKILL_ID/rate" \
    -H "Content-Type: application/json" \
    -d '{
      "userId": "ta_user_004",
      "overallScore": 4,
      "dimensions": {
        "intrinsicQuality": 0.85,
        "usageMetrics": 0.7,
        "socialSignals": 0.9,
        "freshness": 0.8
      }
    }' | python3 -m json.tool 2>/dev/null
fi
echo ""

# Test 8: Agent discovery
echo "8. 测试 Agent 技能发现..."
curl -s "$API_BASE/agent/discover?capabilities=ai,automation" | python3 -m json.tool 2>/dev/null
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"