# Worker Service (`worker/`) — Execution Engine & Process Spawning

The **Worker** is the background processing heartbeat of **Fiddle**. It runs as an independent daemon that continuously polls jobs from the Redis queue, manages code compilation, spawns child OS processes, captures standard input/output streams, and writes final results back to the database.

---

## 1. System Execution Pipeline

```mermaid
flowchart TD
    Queue["Redis Queue ('problems')"] -->|RPOP| Worker["Worker Loop (while true)"]
    
    Worker --> Inspect{Language Type}
    
    %% Compiled Language Branch
    Inspect -->|"c++" (Compiled)| WriteCpp["Write to disk (code/a.cpp)"]
    WriteCpp --> Compile["Spawn compiler (g++ a.cpp -o a.out)"]
    Compile --> CompResult{Exit Code == 0?}
    CompResult -->|No: Error| RejectComp["status: REJECTED\nSave stdErr to DB"]
    CompResult -->|Yes: Success| RunBin["Spawn binary (./a.out)"]
    RunBin --> StreamCollect["Read stdout & stderr streams"]
    
    %% Interpreted Language Branch
    Inspect -->|"python" / "javascript" (Interpreted)| WriteScript["Write to disk (a.py / a.js)"]
    WriteScript --> RunInterp["Spawn runtime (python a.py / node a.js)"]
    RunInterp --> StreamCollect
    
    StreamCollect --> ExitCheck{Process Exit Code}
    ExitCheck -->|0| Accept["status: ACCEPTED\noutput: stdout"]
    ExitCheck -->|Non-Zero| Reject["status: REJECTED\nstdErr: stderr"]
    
    Accept --> SaveDB[(Update PostgreSQL)]
    Reject --> SaveDB
    RejectComp --> SaveDB
```

---

## 2. Deep Theory: Compiled vs. Interpreted Languages

A fundamental concept in building an online code sandbox is understanding how different programming languages are transformed and executed by the operating system:

| Feature | Compiled Languages (e.g. C++) | Interpreted Languages (e.g. Python, JS) |
| :--- | :--- | :--- |
| **Pipeline** | Source Code (`.cpp`) $\rightarrow$ Machine Code (`.out` / `.exe`) $\rightarrow$ Direct CPU Execution | Source Code (`.py` / `.js`) $\rightarrow$ Bytecode $\rightarrow$ Virtual Machine / Interpreter Runtime |
| **Stages Needed** | **Two separate steps**: (1) Compile phase, (2) Execution phase | **One step**: Direct execution via runtime engine |
| **Error Handling** | Syntax/Type errors fail at **Compile Time** before running | Syntax/Type errors fail at **Runtime** during execution |
| **Execution Tool** | `g++` (GCC Compiler) | `python` / `node` |
| **Output File** | Binary executable (`code/a.out`) | No native binary file generated |

---

## 3. Spawning OS Processes (`spawn`) & Stream Streaming

To execute arbitrary code, the worker uses Bun's high-performance native child process API: `spawn`.

### Why `spawn` instead of `exec`?
- **`exec`**: Buffers the entire output in memory before resolving. If user code outputs millions of lines or enters an infinite loop, memory will crash.
- **`spawn`**: Streams the output asynchronously via real-time stream readers (`ReadableStream`), giving precise control over memory and timing.

### 1. The Stream Collector ([index.ts](file:///d:/CPP/100xcode/web/redis/fiddle/worker/index.ts#L9-L22)):
Processes produce data chunks in binary `Uint8Array`. We decode chunks incrementally using `TextDecoder`:
```typescript
async function collectStream(stream: any): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  return buffer;
}
```

### 2. Spawning the C++ Compiler ([index.ts](file:///d:/CPP/100xcode/web/redis/fiddle/worker/index.ts#L24-L43)):
```typescript
async function compileCpp(filePath: string, outputFilePath: string, submissionId: string) {
  console.log("Compiling C++ code...");
  // Launch g++ child process
  const compileProc = spawn(["g++", filePath, "-o", outputFilePath], {
    stderr: "pipe" // Capture compile errors
  });
  
  await compileProc.exited; // Wait for compiler to finish

  if (compileProc.exitCode !== 0) {
    const compileErr = await compileProc.stderr?.text();
    console.error("Compilation failed:\n", compileErr);
    
    // Immediately mark REJECTED in database
    await prisma.submissions.update({
      where: { id: submissionId },
      data: { status: "REJECTED", stdErr: compileErr },
    });
    return false;
  }
  return true;
}
```

### 3. Running Any Program ([index.ts](file:///d:/CPP/100xcode/web/redis/fiddle/worker/index.ts#L46-L71)):
```typescript
async function runProgram(command: string[], submissionId: string, language: string) {
  const proc = spawn(command, {
    stdout: "pipe", // Captures console.log, print(), std::cout
    stderr: "pipe"  // Captures exceptions, stacktraces, std::cerr
  });

  // Read stdout and stderr simultaneously
  const stdoutPromise = collectStream(proc.stdout);
  const stderrPromise = collectStream(proc.stderr);
  const [output, stdErr] = await Promise.all([stdoutPromise, stderrPromise]);
  
  await proc.exited;

  const finalStatus = proc.exitCode === 0 ? "ACCEPTED" : "REJECTED";

  await prisma.submissions.update({
    where: { id: submissionId },
    data: { 
      status: finalStatus, 
      output,
      stdErr: stdErr || null
    },
  });
}
```

---

## 4. Polling the Redis Queue: The Worker Loop

The worker maintains an infinite loop continuously listening for new items on the Redis list:

```typescript
while (true) {
  // Pop the oldest job from the tail
  const response = await client.rPop("problems");
  
  if (!response) {
    // If queue is empty, sleep for 1000ms to avoid busy-waiting / 100% CPU spike
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
    if (success) {
      await runProgram([outputFilePath], submissionId, "c++");
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
```

---

## 5. What We Learned Building This Worker

### 1. Stream Buffering & Deadlocks
If you wait for a process to exit (`await proc.exited`) before draining stdout/stderr streams, a process that outputs more data than the OS kernel pipe buffer (typically 64KB) will **freeze indefinitely** because it cannot write more until the buffer is read.
- **Solution**: Consume streams concurrently (`Promise.all([stdoutPromise, stderrPromise])`) while waiting for process termination.

### 2. Exit Codes
- Operating systems indicate success through exit code `0`.
- Non-zero codes (`1`, `127`, `139 - Segfault`) indicate an error or uncaught exception.
- Mapping `exitCode === 0 ? "ACCEPTED" : "REJECTED"` gives an exact LeetCode-style verdict.

### 3. File System Synchronization
Saving files synchronously (`fs.writeFileSync`) guarantees the file is fully flushed to disk before invoking the compiler or runtime interpreter, avoiding "File not found" race conditions.

---

## 6. How to Run

### Prerequisites:
Make sure your machine has the required compilers / runtimes installed:
- `g++` (MinGW-w64 on Windows or GCC on Linux)
- `python` (Python 3.x)
- `node` (Node.js)

### Start Worker:
```bash
# 1. Install dependencies
bun install

# 2. Start the worker daemon
bun dev
```
The worker will log:
```text
Processing submission <uuid>
Compiling C++ code...
Program output: ...
```
