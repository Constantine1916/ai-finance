#!/usr/bin/env bash
# 检查采集进程心跳：超过 5 分钟没有心跳时由 pm2 重启，并记录日志
set -uo pipefail
export PATH=/root/.nvm/versions/node/v22.22.0/bin:$PATH
AGE=$(docker exec ai-finance-postgres psql -U ai_finance -d ai_finance -Atc "select coalesce(extract(epoch from now() - beat_at)::int, 999999) from worker_heartbeat where id = 'worker'" 2>/dev/null)
if [ -z "$AGE" ] || [ "$AGE" -gt 300 ]; then
  echo "$(date '+%F %T') 心跳 ${AGE:-无} 秒前，重启 ai-finance-worker"
  pm2 restart ai-finance-worker > /dev/null
fi
