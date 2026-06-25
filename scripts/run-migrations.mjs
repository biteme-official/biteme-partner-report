import { Client } from "ssh2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

const BLOCKED_PATTERNS = [
  { pattern: /DROP\s+DATABASE/i, label: "DROP DATABASE" },
  { pattern: /TRUNCATE\s+TABLE/i, label: "TRUNCATE TABLE" },
  { pattern: /DROP\s+TABLE/i, label: "DROP TABLE" },
  { pattern: /DELETE\s+FROM\s+\S+\s*$/im, label: "DELETE without WHERE" },
];

function createTunnel() {
  return new Promise((resolve, reject) => {
    const sshClient = new Client();
    sshClient.on("ready", () => {
      sshClient.forwardOut(
        "127.0.0.1",
        0,
        process.env.DB_HOST,
        parseInt(process.env.DB_PORT),
        (err, stream) => {
          if (err) reject(err);
          else resolve({ sshClient, stream });
        }
      );
    });
    sshClient.on("error", reject);
    sshClient.connect({
      host: process.env.SSH_HOST,
      port: 22,
      username: process.env.SSH_USER,
      privateKey: Buffer.from(process.env.SSH_KEY_BASE64, "base64"),
    });
  });
}

async function main() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const { sshClient, stream } = await createTunnel();

  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    stream,
    charset: "utf8mb4",
    multipleStatements: true,
  });

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [executed] = await connection.execute("SELECT filename FROM _migrations");
  const executedSet = new Set(executed.map((r) => r.filename));
  const newFiles = files.filter((f) => !executedSet.has(f));

  if (newFiles.length === 0) {
    console.log("All migrations already executed.");
    await connection.end();
    sshClient.end();
    return;
  }

  let successCount = 0;

  for (const file of newFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8").trim();

    for (const { pattern, label } of BLOCKED_PATTERNS) {
      if (pattern.test(sql)) {
        console.error(`\n❌ BLOCKED: ${file} contains dangerous operation: ${label}`);
        console.error("이 작업은 수동으로 실행해야 합니다.");
        await connection.end();
        sshClient.end();
        process.exit(1);
      }
    }

    try {
      console.log(`▶ Executing: ${file}`);
      await connection.query(sql);
      await connection.execute("INSERT INTO _migrations (filename) VALUES (?)", [file]);
      console.log(`✓ ${file} — success`);
      successCount++;
    } catch (err) {
      console.error(`\n❌ FAILED: ${file}`);
      console.error(err.message);
      await connection.end();
      sshClient.end();
      process.exit(1);
    }
  }

  console.log(`\n✅ ${successCount} migration(s) completed successfully.`);
  await connection.end();
  sshClient.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
