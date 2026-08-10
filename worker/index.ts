import { createClient } from "redis";
import fs from "fs";
import { spawn } from "bun";
import { db as prisma } from "./src/db";

const client = createClient();
await client.connect();

async function collectOutput(proc: any): Promise<string> {
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

async function compileCpp(filePath: string, outputFilePath: string, submissionId: string) {
  console.log("Compiling C++ code...");
  const compileProc = spawn(["g++", filePath, "-o", outputFilePath]);
  await compileProc.exited;

  if (compileProc.exitCode !== 0) {
    const compileErr = await compileProc.stderr?.text();
    console.error("Compilation failed:\n", compileErr);
    await prisma.submissions.update({
      where: { id: submissionId },
      data: { status: "REJECTED", output: compileErr },
    });
    return false;
  }

  console.log("Compilation successful.");
  return true;
}


async function runProgram(command: string[], submissionId: string, language: string) {
  const proc = spawn(command);
  const output = await collectOutput(proc);
  await proc.exited;

  const finalStatus = proc.exitCode === 0 ? "ACCEPTED" : "REJECTED";
  console.log("Program output:\n", output);

  await prisma.submissions.update({
    where: { id: submissionId },
    data: { status: finalStatus, output },
  });
}

while (true) {
  const response = await client.rPop("problems");
  if (!response) {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  const { code, language, submissionId } = JSON.parse(response);
  console.log("Processing submission", submissionId);

  if (language === "c++") {
    const filePath = __dirname + "/code/a.cpp";
    const outputFilePath = __dirname + "/code/a.out";
    fs.writeFileSync(filePath, code);

    const success = await compileCpp(filePath, outputFilePath, submissionId);
  
    if(success){
      await runProgram([outputFilePath],submissionId, "c++");
    }
  }

  if (language === "python") {
    const filePath = __dirname + "/code/a.py";
    fs.writeFileSync(filePath, code);

    await runProgram(["python", filePath], submissionId, "python");
  }

  if (language === "javascript") {
    const filePath = __dirname + "/code/a.js";
    fs.writeFileSync(filePath, code);

    await runProgram(["node", filePath], submissionId, "javascript");
  }
}
