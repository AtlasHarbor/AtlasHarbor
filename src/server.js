import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const {runStartupMigrations}=await import('./startup-migrations.js');
let migrationStatus;
try{
  migrationStatus=await runStartupMigrations();
  if(migrationStatus.created)console.log(`Database migration applied: ${migrationStatus.migration}`);
  else if(migrationStatus.status==='skipped')console.warn(`Database migration skipped: ${migrationStatus.reason}`);
}catch(error){
  migrationStatus={status:'failed',error:error.message};
  console.error(`Database migration failed: ${error.message}`);
  if(String(process.env.MIGRATION_FAILURE_MODE||'continue').toLowerCase()==='exit')process.exit(1);
}
process.env.STARTUP_MIGRATION_STATUS=JSON.stringify(migrationStatus||{});

const { createApp } = await import("./app.js");
const port = Number(process.env.PORT) || 3000;
createApp().listen(port, () => {
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
  console.log(`Atlas Harbor is running at http://localhost:${port}`);
  console.log(`Supabase: ${supabaseConfigured ? "configured" : "not configured"}`);
  console.log(`Startup migrations: ${migrationStatus?.status||'unknown'}`);
});
