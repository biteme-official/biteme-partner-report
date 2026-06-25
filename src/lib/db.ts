import { Client } from "ssh2";
import mysql from "mysql2/promise";
import { readFileSync, existsSync } from "fs";

function getSSHKey(): Buffer {
  if (process.env.SSH_KEY_BASE64) {
    return Buffer.from(process.env.SSH_KEY_BASE64, "base64");
  }
  if (process.env.SSH_KEY_PATH && existsSync(process.env.SSH_KEY_PATH)) {
    return readFileSync(process.env.SSH_KEY_PATH);
  }
  throw new Error("SSH key not found: set SSH_KEY_BASE64 or SSH_KEY_PATH");
}

async function withConnection<T>(
  fn: (conn: mysql.Connection) => Promise<T>
): Promise<T> {
  const sshClient = new Client();
  const sshKey = getSSHKey();

  const stream = await new Promise<NodeJS.ReadWriteStream>((resolve, reject) => {
    sshClient
      .on("ready", () => {
        sshClient.forwardOut(
          "127.0.0.1", 0,
          process.env.DB_HOST!, Number(process.env.DB_PORT || 3306),
          (err, s) => { if (err) reject(err); else resolve(s); }
        );
      })
      .on("error", reject)
      .connect({
        host: process.env.SSH_HOST!,
        port: Number(process.env.SSH_PORT || 22),
        username: process.env.SSH_USER!,
        privateKey: sshKey,
      });
  });

  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    stream,
    charset: "utf8mb4",
  });

  try {
    return await fn(conn);
  } finally {
    await conn.end();
    sshClient.end();
  }
}

export async function query<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(sql);
    return rows as T[];
  });
}

// 여러 쿼리를 하나의 SSH 터널에서 순차 실행 — 동시 연결 수 최소화
export async function queryBatch<T extends unknown[][]>(
  sqls: string[]
): Promise<T> {
  return withConnection(async (conn) => {
    const results: unknown[][] = [];
    for (const sql of sqls) {
      const [rows] = await conn.execute(sql);
      results.push(rows as unknown[]);
    }
    return results as T;
  });
}
