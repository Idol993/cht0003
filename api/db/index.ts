import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import path from 'path';
import fs from 'fs';

type Database = SqlJsDatabase;

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let dbPath: string = '';
let saveTimeout: NodeJS.Timeout | null = null;

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

async function initSql(): Promise<SqlJsStatic> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
  }
  return SQL;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    const sql = await initSql();
    dbPath = path.join(process.cwd(), 'data', 'express.db');
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new sql.Database(buffer);
    } else {
      db = new sql.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    await initializeDatabase(db);
    scheduleSave();
  }
  return db;
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveDbToDisk();
    scheduleSave();
  }, 2000);
}

function saveDbToDisk() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tmpPath = dbPath + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

process.on('exit', () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveDbToDisk();
});

process.on('SIGINT', () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveDbToDisk();
  process.exit(0);
});

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    }
    
    current += char;
    
    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0 && trimmed !== ';') {
        statements.push(trimmed);
      }
      current = '';
    }
  }
  
  const trimmed = current.trim();
  if (trimmed.length > 0 && trimmed !== ';') {
    statements.push(trimmed);
  }
  
  return statements;
}

async function initializeDatabase(db: Database) {
  const migrationPath = path.join(process.cwd(), 'migrations', '001_init.sql');
  let migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  
  migrationSql = migrationSql.replace(/--.*$/gm, '');
  
  const tablesExist = queryOneSync<any>(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
    []
  );
  
  if (!tablesExist) {
    try {
      const statements = splitSqlStatements(migrationSql);
      for (const stmt of statements) {
        if (stmt.trim().length === 0) continue;
        try {
          db.run(stmt);
        } catch (e: any) {
          console.warn('SQL statement warning:', stmt.substring(0, 60), '->', e.message);
        }
      }
      console.log('Database initialized successfully');
      saveDbToDisk();
    } catch (e) {
      console.error('Failed to initialize database:', e);
      throw e;
    }
  }
}

function bindParams(stmt: any, params: any[] = []) {
  if (params && params.length > 0) {
    stmt.bind(params);
  }
}

function queryOneSync<T>(db: Database, sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  try {
    bindParams(stmt, params);
    if (stmt.step()) {
      const result = stmt.getAsObject() as T;
      return result;
    }
    return undefined;
  } finally {
    stmt.free();
  }
}

function queryManySync<T>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  const results: T[] = [];
  try {
    bindParams(stmt, params);
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

function executeSync(db: Database, sql: string, params: any[] = []): RunResult {
  const stmt = db.prepare(sql);
  try {
    bindParams(stmt, params);
    stmt.step();
  } finally {
    stmt.free();
  }
  
  const lastId = queryOneSync<any>(db, 'SELECT last_insert_rowid() AS id', [])?.id || 0;
  const changes = queryOneSync<any>(db, 'SELECT changes() AS cnt', [])?.cnt || 0;
  
  return {
    lastInsertRowid: lastId,
    changes: changes,
  };
}

export async function queryOne<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  const db = await getDb();
  return queryOneSync<T>(db, sql, params);
}

export async function queryMany<T>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDb();
  return queryManySync<T>(db, sql, params);
}

export async function execute(sql: string, params: any[] = []): Promise<RunResult> {
  const db = await getDb();
  const result = executeSync(db, sql, params);
  scheduleSave();
  return result;
}

export async function executeTransaction<T>(callback: (db: Database) => T): Promise<T> {
  const db = await getDb();
  db.run('BEGIN TRANSACTION');
  try {
    const result = await callback(db);
    db.run('COMMIT');
    scheduleSave();
    return result;
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
