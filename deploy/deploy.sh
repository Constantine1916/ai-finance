#!/usr/bin/env bash
# 在 VPS 上更新部署：拉取代码 → 安装依赖 → 迁移前备份 → 迁移 → 构建 → 重新加载进程
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=/root/.nvm/versions/node/v22.22.0/bin:$PATH
git pull --ff-only origin main
npx --yes npm@11.21.0 ci --no-audit --no-fund
./deploy/backup.sh
npm run db:migrate
npm run build
pm2 reload deploy/ecosystem.config.cjs --update-env
pm2 save
# 单实例 fork 模式下 reload 等于重启，网站约需 1～2 秒才开始监听，最多等 30 秒
for _ in $(seq 30); do
  curl -fsS http://127.0.0.1:3020/api/health 2>/dev/null && echo " 部署完成" && exit 0
  sleep 1
done
echo "健康检查 30 秒内未通过，查看 pm2 logs ai-finance-web" >&2
exit 1
