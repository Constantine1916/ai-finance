#!/usr/bin/env bash
# 每日备份 ai-finance 数据库（pg_dump 自定义格式），保留最近 14 份
set -euo pipefail
DIR=/root/backups/ai-finance
mkdir -p "$DIR"
chmod 700 "$DIR"
FILE="$DIR/ai_finance-$(date +%Y%m%d-%H%M%S).dump"
docker exec ai-finance-postgres pg_dump -U ai_finance -d ai_finance -Fc > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
ls -1t "$DIR"/ai_finance-*.dump | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') 备份完成 $FILE $(du -h "$FILE" | cut -f1)"
