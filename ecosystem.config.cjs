module.exports = {
  apps: [
    {
      name: 'transit-board',
      cwd: './apps/backend',
      script: process.env.HOME + '/.bun/bin/bun',
      args: 'src/index.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
