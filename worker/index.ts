import { createClient } from "redis";
import fs from "fs";
import { spawn } from "bun";
import { db as prisma } from "./src/db";

const client = createClient();
await client.connect();




while (true) {
  const response = await client.rPop("problems");
  if (!response) {
    await new Promise((r) => setTimeout(r, 1000));
    continue;
  }

  const { code, language, submissionId } = JSON.parse(response);
  console.log("Processing submission", submissionId);

  // C++ branch
  if (language === "c++") {
    const filePath = __dirname + "/code/a.cpp";
    const outputFilePath = __dirname + "/code/a.out";
    fs.writeFileSync(filePath, code);

    console.log("Compiling C++ code...");
    const compileProc = spawn(["g++", filePath, "-o", outputFilePath]);
    await compileProc.exited;

    if (compileProc.exitCode !== 0) {
      const compileErr = await compileProc.stderr?.text();
      console.error("Compilation failed:\n", compileErr);
      await prisma.submissions.update({
        where: { id: submissionId },
        data: {
          status: "REJECTED",
          output: compileErr,
        },
      });
      continue;
    }

    console.log("Compilation successful. Running program...");
    const runProc = spawn([outputFilePath]);
    const reader = runProc.stdout?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    await runProc.exited;
    const finalStatus = runProc.exitCode === 0 ? "ACCEPTED" : "REJECTED";

    console.log("Program output:\n", buffer);
    await prisma.submissions.update({
      where: { id: submissionId },
      data: {
        status: finalStatus,
        output: buffer,
      },
    });
  }

  // Python branch
  if (language === "python") {
    const filePath = __dirname + "/code/a.py";
    fs.writeFileSync(filePath, code);

    console.log("Running Python code...");
    const proc = spawn(["python", filePath]);
    const reader = proc.stdout?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    await proc.exited;
    const finalStatus = proc.exitCode === 0 ? "ACCEPTED" : "REJECTED";

    console.log("Output:\n", buffer);
    await prisma.submissions.update({
      where: { id: submissionId },
      data: {
        status: finalStatus,
        output: buffer,
      },
    });
  }

  // JavaScript branch
  if (language === "javascript") {
    const filePath = __dirname + "/code/a.js";
    fs.writeFileSync(filePath, code);

    console.log("Running JavaScript code...");
    const proc = spawn(["node", filePath]);
    const reader = proc.stdout?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }

    await proc.exited;
    const finalStatus = proc.exitCode === 0 ? "ACCEPTED" : "REJECTED";

    console.log("Output:\n", buffer);
    await prisma.submissions.update({
      where: { id: submissionId },
      data: {
        status: finalStatus,
        output: buffer,
      },
    });
  }
}