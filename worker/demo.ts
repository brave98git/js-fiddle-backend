import { createClient } from "redis";
import fs from "fs";
import { spawn } from "bun";
import { db } from "./src/db"; // assume pg client wrapper

// Utility: collect stdout chunks into a string
async function collectOutput(proc:any) {
  const reader = proc.stdout?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  return buffer;
}

// Language handlers
async function handleCpp(code, userId, submissionId) {
  const filePath = __dirname + "/code/a.cpp";
  const outputFilePath = __dirname + "/code/a.out";
  fs.writeFileSync(filePath, code);

  console.log("Compiling C++ code...");
  const compileProc = spawn(["g++", filePath, "-o", outputFilePath]);
  const compileErr = await compileProc.stderr?.text();
  if (compileErr) {
    console.error("Compilation failed:\n", compileErr);
    await db.query(
      "INSERT INTO submissions(user_id, submission_id, language, output) VALUES($1,$2,$3,$4)",
      [userId, submissionId, "c++", compileErr]
    );
    return;
  }

  console.log("Compilation successful. Running program...");
  const runProc = spawn([outputFilePath]);
  const runOutput = await collectOutput(runProc);
  console.log("Program output:\n", runOutput);

  await db.query(
    "INSERT INTO submissions(user_id, submission_id, language, output) VALUES($1,$2,$3,$4)",
    [userId, submissionId, "c++", runOutput]
  );
}

async function handlePython(code, userId, submissionId) {
  const filePath = __dirname + "/code/a.py";
  fs.writeFileSync(filePath, code);

  console.log("Running Python code...");
  const proc = spawn(["python", filePath]);
  const output = await collectOutput(proc);
  console.log("Output:\n", output);

  await db.query(
    "INSERT INTO submissions(user_id, submission_id, language, output) VALUES($1,$2,$3,$4)",
    [userId, submissionId, "python", output]
  );
}

async function handleJs(code, userId, submissionId) {
  const filePath = __dirname + "/code/a.js";
  fs.writeFileSync(filePath, code);

  console.log("Running JavaScript code...");
  const proc = spawn(["node", filePath]);
  const output = await collectOutput(proc);
  console.log("Output:\n", output);

  await db.query(
    "INSERT INTO submissions(user_id, submission_id, language, output) VALUES($1,$2,$3,$4)",
    [userId, submissionId, "javascript", output]
  );
}

// Main loop
const client = createClient();
await client.connect();

while (true) {
  const response = await client.rPop("problems");
  if (!response) {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  const { code, userId, language, submissionId } = JSON.parse(response);
  console.log("Processing submission", submissionId, "for user", userId);

  if (language === "c++") await handleCpp(code, userId, submissionId);
  if (language === "python") await handlePython(code, userId, submissionId);
  if (language === "javascript") await handleJs(code, userId, submissionId);
}
