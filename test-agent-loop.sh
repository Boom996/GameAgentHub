#!/bin/bash
# GameAgentHub — Agent 全生命周期闭环测试
# 开源游戏研发技能平台 — 模拟 AI Agent 完整流程：
#   注册 → 创建 zip → 上传 → 搜索验证 → 下载校验 → GDI 评分 → 发现接口验证

set -euo pipefail
BASE="${GAMEAGENTHUB_URL:-http://localhost:3000}"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass=0; fail=0; total=0
TMP=""

cleanup() {
  [ -n "$TMP" ] && rm -rf "$TMP"
  rm -f /tmp/gah_upload.json /tmp/gah_download.zip /tmp/gah_discover.json /tmp/gah_search.json /tmp/gah_rate.json /tmp/gah_stats.json
}
trap cleanup EXIT

assert() {
  local name="$1" expected="$2" actual="$3"
  total=$((total+1))
  if [ "$actual" = "$expected" ]; then
    echo -e "    ${GREEN}✓${NC} $name"
    pass=$((pass+1))
  else
    echo -e "    ${RED}✗${NC} $name (expected $expected, got $actual)"
    fail=$((fail+1))
  fi
}

assert_contains() {
  local name="$1" needle="$2" haystack="$3"
  total=$((total+1))
  if echo "$haystack" | grep -q "$needle" 2>/dev/null; then
    echo -e "    ${GREEN}✓${NC} $name"
    pass=$((pass+1))
  else
    echo -e "    ${RED}✗${NC} $name (\"$needle\" not found)"
    fail=$((fail+1))
  fi
}

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  GameAgentHub — Agent Lifecycle Loop Test      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Phase 0: Pre-flight ────────────────────────────────────
echo -e "${YELLOW}[0] Pre-flight Checks${NC}"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
assert "Server reachable (GET /health)" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/capabilities")
assert "Capabilities endpoint" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/stats")
assert "Stats endpoint" "200" "$code"

STATS_BEFORE=$(curl -s "$BASE/api/stats")
SKILLS_BEFORE=$(echo "$STATS_BEFORE" | grep -o '"total_skills":[0-9]*' | cut -d: -f2)
echo -e "    ↳ Current skills: $SKILLS_BEFORE"

# ─── Phase 1: Agent Registration ────────────────────────────
echo ""
echo -e "${YELLOW}[1] Agent Registration${NC}"
REG=$(curl -s -X POST "$BASE/api/agents/register" \
  -H "Content-Type: application/json" \
  -d '{"agent_name":"loop-test-agent","scopes":["read","write"],"expires_in_days":1}')
API_KEY=$(echo "$REG" | grep -o '"api_key":"[^"]*"' | cut -d'"' -f4)
AGENT_ID=$(echo "$REG" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)

total=$((total+1))
if [ -n "$API_KEY" ] && [ ${#API_KEY} -gt 20 ]; then
  echo -e "    ${GREEN}✓${NC} Registered (key: ${API_KEY:0:16}...)"
  pass=$((pass+1))
else
  echo -e "    ${RED}✗${NC} Registration failed"
  fail=$((fail+1))
  echo "Aborting: cannot proceed without API Key"
  exit 1
fi

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agents/me" \
  -H "Authorization: Bearer $API_KEY")
assert "Agent identity (GET /api/agents/me)" "200" "$code"

# ─── Phase 2: Create Skill Package ──────────────────────────
echo ""
echo -e "${YELLOW}[2] Create Skill Package${NC}"
TMP=$(mktemp -d)
SKILL_NAME="loop-test-skill-$(date +%s)"

cat > "$TMP/manifest.json" <<MEOF
{
  "name": "$SKILL_NAME",
  "version": "1.0.0",
  "description": "Automated loop test skill created by test-agent-loop.sh",
  "tags": ["test", "automation", "loop"],
  "category": "testing",
  "entry_point": "src/main.py",
  "compatibility": { "cursor_min_version": "0.40.0" }
}
MEOF

cat > "$TMP/SKILL.md" <<'SEOF'
# Loop Test Skill

This skill was created automatically by the GameAgentHub loop test.
It verifies the complete Agent lifecycle: register → upload → search → download → rate.
SEOF

mkdir -p "$TMP/src"
echo 'print("Hello from loop test skill")' > "$TMP/src/main.py"
(cd "$TMP" && zip -r skill.zip manifest.json SKILL.md src/ > /dev/null 2>&1)

UPLOAD_SIZE=$(wc -c < "$TMP/skill.zip" | tr -d ' ')
assert "Skill zip created (${UPLOAD_SIZE} bytes)" "true" "true"

# ─── Phase 3: Upload ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3] Upload Skill${NC}"
code=$(curl -s -o /tmp/gah_upload.json -w "%{http_code}" \
  -X POST "$BASE/api/skills" \
  -H "Authorization: Bearer $API_KEY" \
  -F "file=@$TMP/skill.zip")
assert "POST /api/skills (upload)" "201" "$code"

SKILL_ID=$(cat /tmp/gah_upload.json | grep -o '"skill_id":"[^"]*"' | cut -d'"' -f4)
total=$((total+1))
if [ -n "$SKILL_ID" ]; then
  echo -e "    ${GREEN}✓${NC} Got skill_id: $SKILL_ID"
  pass=$((pass+1))
else
  echo -e "    ${RED}✗${NC} No skill_id in response"
  fail=$((fail+1))
fi

# ─── Phase 4: Search & Verify ───────────────────────────────
echo ""
echo -e "${YELLOW}[4] Search & Verify Upload${NC}"

LIST=$(curl -s "$BASE/api/skills")
assert_contains "Skill appears in listing" "$SKILL_NAME" "$LIST"

SEARCH=$(curl -s "$BASE/api/skills?q=loop+test")
assert_contains "Skill found via search" "$SKILL_NAME" "$SEARCH"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills/$SKILL_ID")
assert "Skill detail page (GET /api/skills/:id)" "200" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/skills/$SKILL_ID/manifest")
assert "Manifest accessible" "200" "$code"

MANIFEST=$(curl -s "$BASE/api/skills/$SKILL_ID/manifest")
assert_contains "Manifest has correct name" "$SKILL_NAME" "$MANIFEST"

# ─── Phase 5: Download & Checksum ───────────────────────────
echo ""
echo -e "${YELLOW}[5] Download & Verify${NC}"

HEADERS=$(curl -s -D - -o /tmp/gah_download.zip "$BASE/api/skills/$SKILL_ID/download")
code=$(echo "$HEADERS" | head -1 | grep -o '[0-9][0-9][0-9]')
assert "Download returns 200" "200" "$code"

DL_SIZE=$(wc -c < /tmp/gah_download.zip | tr -d ' ')
total=$((total+1))
if [ "$DL_SIZE" -gt 0 ]; then
  echo -e "    ${GREEN}✓${NC} Downloaded file: $DL_SIZE bytes"
  pass=$((pass+1))
else
  echo -e "    ${RED}✗${NC} Downloaded file is empty"
  fail=$((fail+1))
fi

SERVER_SHA=$(echo "$HEADERS" | grep -i 'x-checksum-sha256' | tr -d '\r' | awk '{print $2}')
if [ -n "$SERVER_SHA" ]; then
  if command -v shasum &>/dev/null; then
    LOCAL_SHA=$(shasum -a 256 /tmp/gah_download.zip | awk '{print $1}')
  elif command -v sha256sum &>/dev/null; then
    LOCAL_SHA=$(sha256sum /tmp/gah_download.zip | awk '{print $1}')
  else
    LOCAL_SHA="$SERVER_SHA"
  fi
  assert "SHA-256 checksum match" "$SERVER_SHA" "$LOCAL_SHA"
else
  total=$((total+1))
  echo -e "    ${YELLOW}-${NC} No X-Checksum-SHA256 header (skipped)"
fi

# ─── Phase 6: Rate (GDI) ────────────────────────────────────
echo ""
echo -e "${YELLOW}[6] GDI Rating${NC}"

code=$(curl -s -o /tmp/gah_rate.json -w "%{http_code}" \
  -X POST "$BASE/api/skills/$SKILL_ID/rate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"intrinsic_quality":0.85,"usage_metrics":0.70,"social_signals":0.80,"freshness":0.90}')
assert "POST /api/skills/:id/rate" "200" "$code"

RATE_RESP=$(cat /tmp/gah_rate.json)
assert_contains "GDI score returned" "gdi_score" "$RATE_RESP"

DETAIL=$(curl -s "$BASE/api/skills/$SKILL_ID")
assert_contains "Skill detail reflects GDI update" "gdi" "$DETAIL"

# ─── Phase 7: Agent-Specific APIs ───────────────────────────
echo ""
echo -e "${YELLOW}[7] Agent Discovery & Search APIs${NC}"

code=$(curl -s -o /tmp/gah_discover.json -w "%{http_code}" "$BASE/api/agent/discover" \
  -H "Authorization: Bearer $API_KEY")
assert "GET /api/agent/discover" "200" "$code"

DISCOVER=$(cat /tmp/gah_discover.json)
assert_contains "Discover includes uploaded skill" "$SKILL_NAME" "$DISCOVER"
assert_contains "Discover has download_url" "download_url" "$DISCOVER"

code=$(curl -s -o /tmp/gah_search.json -w "%{http_code}" "$BASE/api/agent/search?q=loop" \
  -H "Authorization: Bearer $API_KEY")
assert "GET /api/agent/search" "200" "$code"

SEARCH_RESP=$(cat /tmp/gah_search.json)
assert_contains "Agent search finds skill" "$SKILL_NAME" "$SEARCH_RESP"

# ─── Phase 8: Stats Verification ────────────────────────────
echo ""
echo -e "${YELLOW}[8] Stats Updated${NC}"

STATS_AFTER=$(curl -s "$BASE/api/stats")
SKILLS_AFTER=$(echo "$STATS_AFTER" | grep -o '"total_skills":[0-9]*' | cut -d: -f2)
total=$((total+1))
if [ "$SKILLS_AFTER" -gt "$SKILLS_BEFORE" ]; then
  echo -e "    ${GREEN}✓${NC} total_skills increased ($SKILLS_BEFORE → $SKILLS_AFTER)"
  pass=$((pass+1))
else
  echo -e "    ${RED}✗${NC} total_skills did not increase ($SKILLS_BEFORE → $SKILLS_AFTER)"
  fail=$((fail+1))
fi

# ─── Phase 9: Auth Guards ───────────────────────────────────
echo ""
echo -e "${YELLOW}[9] Auth Guards${NC}"

code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/agents/me")
assert "No auth → 401" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE/api/skills" -H "Content-Type: application/json" -d '{}')
assert "Upload no auth → 401" "401" "$code"

code=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE/api/agents/me" -H "Authorization: Bearer gah_invalid_key")
assert "Bad API key → 401" "401" "$code"

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Results: ${GREEN}${pass} passed${CYAN}  ${RED}${fail} failed${CYAN}  (${total} total)     ║${NC}"
if [ "$fail" -eq 0 ]; then
  echo -e "${CYAN}║  ${GREEN}ALL TESTS PASSED ✓${CYAN}                             ║${NC}"
else
  echo -e "${CYAN}║  ${RED}SOME TESTS FAILED ✗${CYAN}                             ║${NC}"
fi
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"

[ "$fail" -eq 0 ] || exit 1
