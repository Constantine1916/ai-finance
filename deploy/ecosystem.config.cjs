// pm2 进程定义：网站与采集进程。运行配置从仓库根目录 .env 读取（Next.js 自动读取；worker 通过 --env-file）
const cwd = `${__dirname}/..`;

module.exports = {
  apps: [
    {
      name: "ai-finance-web",
      cwd,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3020",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      time: true,
    },
    {
      name: "ai-finance-worker",
      cwd,
      script: "node_modules/.bin/tsx",
      args: "--env-file=.env src/worker/index.ts",
      interpreter: "none",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
      kill_timeout: 10000,
      time: true,
    },
  ],
};
