const { execSync } = require('child_process');

function run(cmd, label) {
  try {
    console.log(`[startup] ${label}...`);
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.warn(`[startup] ${label} falhou, continuando...`);
  }
}

run('prisma db push --accept-data-loss --skip-generate', 'db push');
run('tsx scripts/seed-admin.ts', 'seed admin');
execSync('next start', { stdio: 'inherit' });
