import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const {Client}=pg;

function databaseUrlFromEnv(env){
 if(env.DATABASE_URL||env.SUPABASE_DATABASE_URL)return env.DATABASE_URL||env.SUPABASE_DATABASE_URL;
 if(!env.SUPABASE_URL||!env.SUPABASE_DB_PASSWORD)return null;
 try{
  const projectRef=new URL(env.SUPABASE_URL).hostname.split('.')[0];
  const host=env.SUPABASE_DB_HOST||`db.${projectRef}.supabase.co`;
  const user=env.SUPABASE_DB_USER||'postgres';
  const port=env.SUPABASE_DB_PORT||'5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${host}:${port}/postgres?sslmode=require`;
 }catch{return null}
}

function clientConfig(connectionString){
 const ssl=/sslmode=require/i.test(connectionString)||/supabase\.(co|com)/i.test(connectionString);
 return{connectionString,ssl:ssl?{rejectUnauthorized:false}:undefined,connectionTimeoutMillis:15000,statement_timeout:60000,query_timeout:60000};
}

export async function runStartupMigrations({env=process.env,root=process.cwd()}={}){
 const databaseUrl=databaseUrlFromEnv(env);
 const enabled=String(env.AUTO_MIGRATE??'true').toLowerCase()!=='false';
 if(!enabled)return{enabled:false,status:'disabled'};
 if(!databaseUrl)return{enabled:true,status:'skipped',reason:'Set DATABASE_URL, SUPABASE_DATABASE_URL, or SUPABASE_DB_PASSWORD so startup can create tables.'};
 const client=new Client(clientConfig(databaseUrl));
 try{
  await client.connect();
  const check=await client.query("select to_regclass('public.admin_system') is not null as exists");
  if(check.rows[0]?.exists)return{enabled:true,status:'ready',created:false};
  const migrationPath=path.join(root,'supabase','admin-ai-featured.sql');
  const sql=await fs.readFile(migrationPath,'utf8');
  await client.query('begin');
  try{
   await client.query(sql);
   await client.query('commit');
  }catch(error){
   await client.query('rollback').catch(()=>{});
   throw error;
  }
  await client.query("select pg_notify('pgrst','reload schema')").catch(()=>{});
  return{enabled:true,status:'ready',created:true,migration:'supabase/admin-ai-featured.sql'};
 }finally{
  await client.end().catch(()=>{});
 }
}
