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

export async function query<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const sshClient = new Client();
  const sshKey = getSSHKey();

  const stream = await new Promise<NodeJS.ReadWriteStream>(
    (resolve, reject) => {
      sshClient
        .on("ready", () => {
          sshClient.forwardOut(
            "127.0.0.1",
            0,
            process.env.DB_HOST!,
            Number(process.env.DB_PORT || 3306),
            (err, s) => {
              if (err) reject(err);
              else resolve(s);
            }
          );
        })
        .on("error", reject)
        .connect({
          host: process.env.SSH_HOST!,
          port: Number(process.env.SSH_PORT || 22),
          username: process.env.SSH_USER!,
          privateKey: sshKey,
        });
    }
  );

  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    stream,
    charset: "utf8mb4",
  });

  try {
    const [rows] = await conn.execute(sql);
    return rows as T[];
  } finally {
    await conn.end();
    sshClient.end();
  }
}
