#!/bin/bash
# GameAgentHub v2.0 API 全流程测试
# 覆盖：Agent 注册 → zip 上传 → 搜索 → 下载 → 评分 → 发现

set -e
BASE="http://localhost:3000"
GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
pass=0; fail=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} $name (HTTP $actual)"
    pass=$((pass+1))
  else
    echo -e "  ${RED}FAIL${NC} $name (expected $expected, got $actual)"
    fail=$((fail+1))
  fi
}

echo "=== GameAgentHub v2.0 API Test ==="
echo ""

# 1. Health check
echo "[1] Health & System"
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/health)
check "GET /health" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/capabilities)
check "GET /api/capabilities" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/openapi.json)
check "GET /api/openapi.json" "200" "$code"

# 2. Agent registration
echo ""
echo "[2] Agent Register"
REG=$(curl -s -X POST $BASE/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"test-bot","scopes":["read","write"],"expires_in_days":30}')
API_KEY=$(echo "$REG" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
AGENT_ID=$(echo "$REG" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$API_KEY" ]; then
  echo -e "  ${GREEN}PASS${NC} POST /api/agents/register (got key: ${API_KEY:0:12}...)"
  pass=$((pass+1))
else
  echo -e "  ${RED}FAIL${NC} POST /api/agents/register (no api_key)"
  fail=$((fail+1))
fi

code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/agents/me \
  -H "Authorization: Bearer $API_KEY")
check "GET /api/agents/me" "200" "$code"

# 3. Create test skill zip
echo ""
echo "[3] Skill Upload"
TMP=$(mktemp -d)
mkdir -p "$TMP/src"
cat > "$TMP/manifest.json" << 'EOF'
{"name":"test-automation","version":"1.0.0","description":"Test automation skill for CI","tags":["test","automation"],"category":"testing","entry_point":"src/main.py"}
EOF
echo "# Test Automation Skill" > "$TMP/SKILL.md"
echo "print('hello')" > "$TMP/src/main.py"
(cd "$TMP" && zip -r skill.zip manifest.json SKILL.md src/ > /dev/null 2>&1)

code=$(curl -s -o /tmp/upload_resp.json -w "%{http_code}" \
  -X POST $BASE/api/skills \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@$TMP/skill.zip")
check "POST /api/skills (upload)" "201" "$code"
SKILL_ID=$(cat /tmp/upload_resp.json | grep -o '"skill_id":"[^"]*"' | cut -d'"' -f4)
echo "  skill_id=$SKILL_ID"
rm -rf "$TMP"

# 4. List & Search
echo ""
echo "[4] Skill List & Search"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills")
check "GET /api/skills" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills?q=automation")
check "GET /api/skills?q=automation" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills/$SKILL_ID")
check "GET /api/skills/:id" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills/$SKILL_ID/manifest")
check "GET /api/skills/:id/manifest" "200" "$code"

# 5. Download
echo ""
echo "[5] Skill Download"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills/$SKILL_ID/download")
check "GET /api/skills/:id/download" "200" "$code"

# 6. Rating
echo ""
echo "[6] Skill Rating"
code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/api/skills/$SKILL_ID/rate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"intrinsic_quality":0.8,"usage_metrics":0.7,"social_signals":0.9,"freshness":0.8}')
check "POST /api/skills/:id/rate" "200" "$code"

# 7. Agent API
echo ""
echo "[7] Agent API"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agent/discover")
check "GET /api/agent/discover" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agent/search?q=test")
check "GET /api/agent/search?q=test" "200" "$code"

# 8. Auth guard
echo ""
echo "[8] Auth Guards"
code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/agents/me)
check "GET /api/agents/me (no auth → 401)" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST $BASE/api/skills \
  -H "Content-Type: application/json" \
  -d '{}')
check "POST /api/skills (no auth → 401)" "401" "$code"

# Summary
echo ""
echo "================================"
echo -e "Passed: ${GREEN}${pass}${NC}  Failed: ${RED}${fail}${NC}  Total: $((pass+fail))"
if [ $fail -eq 0 ]; then echo -e "${GREEN}All tests passed!${NC}"; else echo -e "${RED}Some tests failed.${NC}"; exit 1; fi
