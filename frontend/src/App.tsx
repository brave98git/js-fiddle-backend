import axios from "axios";
import { useState, useEffect, useRef } from "react";
import {
  Play,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  RotateCcw,
  Activity,
  Maximize2,
  Minimize2,
  Trash2,
  Sliders
} from "lucide-react";
import { 
  SiCplusplus, 
  SiJavascript, 
  SiPython,
  SiRedis
} from "react-icons/si";
import { AiOutlineDingding } from "react-icons/ai";
import { VscTerminal } from "react-icons/vsc";
import "./index.css";

const BACKEND_URL = "http://localhost:3000";

type Language = "c++" | "javascript" | "python";
type ExecutionStatus = "IDLE" | "PENDING" | "ACCEPTED" | "REJECTED" | "ERROR";

const STARTER_CODE: Record<Language, { filename: string; template: string }> = {
  "c++": {
    filename: "solution.cpp",
    template: `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::cout << "FIDDLE C++ Runtime Initialized\\n";
    
    std::vector<int> numbers = {10, 20, 30, 40, 50};
    int total = 0;
    for (int n : numbers) total += n;
    
    std::cout << "Sum of elements: " << total << "\\n";
    std::cout << "Execution completed successfully.\\n";
    return 0;
}`
  },
  javascript: {
    filename: "index.js",
    template: `/**
 * FIDDLE Node.js Runtime
 */
console.log("FIDDLE JavaScript Runtime Initialized");

const services = [
  { id: 1, name: "Redis Stream", status: "Active" },
  { id: 2, name: "Worker Pod", status: "Ready" },
  { id: 3, name: "PGlite Memory", status: "Connected" }
];

console.table(services);
console.log("Execution finished without errors.");`
  },
  python: {
    filename: "script.py",
    template: `# FIDDLE Python Runtime
import sys

print(f"Python version: {sys.version.split()[0]}")

def compute_fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    while len(fib) < n:
        fib.append(fib[-1] + fib[-2])
    return fib

result = compute_fibonacci(8)
print(f"Fibonacci series: {result}")
print("Execution finished successfully.")`
  }
};

export function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("c++");
  const [code, setCode] = useState(STARTER_CODE["c++"].template);
  const [status, setStatus] = useState<ExecutionStatus>("IDLE");
  const [output, setOutput] = useState("");
  const [stdErr, setStdErr] = useState("");
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"output" | "diagnostics">("output");
  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleLanguageChange = (lang: Language) => {
    setSelectedLanguage(lang);
    setCode(STARTER_CODE[lang].template);
    setStatus("IDLE");
    setOutput("");
    setStdErr("");
    setCurrentSubmissionId(null);
    setElapsedTime(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (status !== "PENDING") {
          runCode();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [code, selectedLanguage, status]);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const resetCode = () => {
    setCode(STARTER_CODE[selectedLanguage].template);
  };

  const runCode = async () => {
    setStatus("PENDING");
    setOutput("");
    setStdErr("");
    setElapsedTime(0);
    startTimeRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 50);

    try {
      const response = await axios.post(`${BACKEND_URL}/submission`, {
        code,
        language: selectedLanguage
      });

      const subId = response.data.submissionId;
      if (!subId) {
        setStatus("ERROR");
        setOutput("Failed to retrieve submission ID from backend.");
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      setCurrentSubmissionId(subId);
      pollBackend(subId);
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setOutput(err?.response?.data?.message || "Failed to connect to backend server. Make sure it is running on port 3000.");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const pollBackend = async (submissionId: string) => {
    let attempts = 0;
    const maxAttempts = 40;

    const checkStatus = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/submission/${submissionId}`);
        const data = response.data;

        if (data.status === "PENDING") {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 700);
          } else {
            setStatus("ERROR");
            setOutput("Execution timed out waiting for worker response.");
            if (timerRef.current) clearInterval(timerRef.current);
          }
        } else {
          setStatus(data.status);
          setOutput(data.output || "");
          setStdErr(data.stdErr || "");
          if (timerRef.current) clearInterval(timerRef.current);
          setElapsedTime(Date.now() - startTimeRef.current);
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setStatus("ERROR");
        setOutput("Failed to poll execution result from server.");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    setTimeout(checkStatus, 500);
  };

  const linesCount = code.split("\n").length;
  const lineNumbers = Array.from({ length: Math.max(linesCount, 18) }, (_, i) => i + 1);

  return (
    <div className={`min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans antialiased selection:bg-zinc-800 selection:text-zinc-100 ${isFullscreen ? "fixed inset-0 z-50" : ""}`}>
      {/* Top Navigation Bar - Clean Minimalist Linear/Dub style */}
      <header className="border-b border-zinc-800/80 bg-[#09090b] px-5 py-3.5 flex items-center justify-between z-20">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shadow-sm">
              <AiOutlineDingding className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-100">
              Fiddle
            </span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
            <SiRedis className="h-3.5 w-3.5 text-red-400" />
            <span>redis-queue</span>
          </div>
        </div>

        {/* Language Tabs - Exact Vector Icons */}
        <div className="flex items-center p-1 bg-zinc-900/90 rounded-lg border border-zinc-800">
          <button
            onClick={() => handleLanguageChange("c++")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${
              selectedLanguage === "c++"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SiCplusplus className="h-4 w-4 text-[#00599C]" />
            <span className="text-xs font-medium">C++</span>
          </button>

          <button
            onClick={() => handleLanguageChange("javascript")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${
              selectedLanguage === "javascript"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SiJavascript className="h-4 w-4 text-[#F7DF1E]" />
            <span className="text-xs font-medium">JavaScript</span>
          </button>

          <button
            onClick={() => handleLanguageChange("python")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-2 ${
              selectedLanguage === "python"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <SiPython className="h-4 w-4 text-[#3776AB]" />
            <span className="text-xs font-medium">Python</span>
          </button>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="p-2 rounded-md hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors hidden md:flex"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            onClick={resetCode}
            title="Reset buffer"
            className="px-2.5 py-1.5 rounded-md hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-medium hidden sm:flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          {/* Minimalist Run Button */}
          <button
            onClick={runCode}
            disabled={status === "PENDING"}
            className={`h-8 px-3.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
              status === "PENDING"
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                : "bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm active:scale-[0.98] cursor-pointer"
            }`}
          >
            {status === "PENDING" ? (
              <>
                <span className="h-3.5 w-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Running</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-zinc-900" />
                <span className="text-xs font-semibold">Run</span>
                <span className="ml-1 text-[10px] font-mono text-zinc-500 bg-zinc-200/80 px-1.5 py-0.5 rounded">
                  ⌘↵
                </span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split-Pane Workspace */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Pane: Editor */}
        <section className="flex-1 flex flex-col min-h-[45vh] md:min-h-0 border-b md:border-b-0 md:border-r border-zinc-800/80 bg-[#09090b]">
          {/* Editor Header Bar */}
          <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-800/60 bg-zinc-900/30 select-none">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-zinc-300">
                {selectedLanguage === "c++" && <SiCplusplus className="h-3 w-3 text-[#00599C]" />}
                {selectedLanguage === "javascript" && <SiJavascript className="h-3 w-3 text-[#F7DF1E]" />}
                {selectedLanguage === "python" && <SiPython className="h-3 w-3 text-[#3776AB]" />}
                <span className="text-[11px] font-mono text-zinc-300">
                  {STARTER_CODE[selectedLanguage].filename}
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-600">
                {linesCount} L
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={copyCode}
                className="px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors text-[11px] flex items-center gap-1 font-mono"
                title="Copy code"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span className="text-[10px]">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setCode("")}
                className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
                title="Clear code"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Editor Core */}
          <div className="flex-1 relative flex overflow-hidden font-mono text-[15px] leading-relaxed">
            {/* Minimal Gutter */}
            <div 
              className="py-3 pl-3 pr-2 select-none text-right font-mono text-zinc-600 bg-zinc-950/40 border-r border-zinc-800/40 overflow-hidden min-w-[3rem]"
              aria-hidden="true"
            >
              {lineNumbers.map((num) => (
                <div key={num} className="leading-7 text-[13px] opacity-50 hover:opacity-100 transition-opacity">
                  {num}
                </div>
              ))}
            </div>

            {/* Code Input */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 p-3 bg-transparent resize-none outline-none font-mono text-[15px] text-zinc-100 placeholder:text-zinc-700 leading-7 selection:bg-zinc-800 overflow-auto"
              placeholder="// Write code here..."
            />
          </div>

          {/* Editor Footer Status */}
          <div className="h-6 px-3 border-t border-zinc-800/60 bg-zinc-950 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
            <span>UTF-8</span>
            <span>Ctrl + Enter to run</span>
          </div>
        </section>

        {/* Right Pane: Terminal / Output */}
        <section className="flex-1 flex flex-col min-h-[45vh] md:min-h-0 bg-[#09090b]">
          {/* Header Bar */}
          <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-800/60 bg-zinc-900/30 select-none">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("output")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "output"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <VscTerminal className="h-3 w-3" />
                <span>Console</span>
              </button>
              <button
                onClick={() => setActiveTab("diagnostics")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === "diagnostics"
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders className="h-3 w-3" />
                <span>Diagnostics</span>
              </button>
            </div>

            {/* Minimalist Status Pill */}
            <div className="flex items-center gap-2">
              {elapsedTime !== null && (
                <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                  <Clock className="h-2.5 w-2.5 text-zinc-500" />
                  <span>{(elapsedTime / 1000).toFixed(2)}s</span>
                </div>
              )}

              {status === "IDLE" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  <span>Idle</span>
                </div>
              )}

              {status === "PENDING" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>Running</span>
                </div>
              )}

              {status === "ACCEPTED" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>Accepted</span>
                </div>
              )}

              {status === "REJECTED" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-rose-400">
                  <AlertCircle className="h-3 w-3 text-rose-400" />
                  <span>Exit Code &gt; 0</span>
                </div>
              )}

              {status === "ERROR" && (
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
                  <AlertCircle className="h-3 w-3 text-amber-400" />
                  <span>Error</span>
                </div>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 p-4 overflow-auto flex flex-col justify-between font-mono text-[12px] leading-relaxed">
            {activeTab === "output" ? (
              <div className="space-y-3">
                {status === "IDLE" && !output && !stdErr && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 text-zinc-600">
                    <Terminal className="h-5 w-5 mb-2 text-zinc-700" />
                    <p className="text-xs text-zinc-500 font-medium">Terminal Idle</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">Ctrl+Enter</kbd> to execute
                    </p>
                  </div>
                )}

                {status === "PENDING" && !output && (
                  <div className="flex items-center gap-2.5 p-3 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
                    <span className="h-3 w-3 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    <span>Queued in Redis. Waiting for worker...</span>
                  </div>
                )}

                {output && (
                  <div>
                    <div className="text-[11px] font-mono text-zinc-500 mb-1">stdout:</div>
                    <pre className="p-3.5 rounded-md bg-zinc-950 border border-zinc-800/80 text-zinc-200 whitespace-pre-wrap font-mono text-[13.5px] leading-relaxed overflow-x-auto">
                      {output}
                    </pre>
                  </div>
                )}

                {stdErr && (
                  <div>
                    <div className="text-[11px] font-mono text-rose-400 mb-1">stderr:</div>
                    <pre className="p-3.5 rounded-md bg-zinc-950 border border-rose-900/40 text-rose-300 whitespace-pre-wrap font-mono text-[13.5px] leading-relaxed overflow-x-auto">
                      {stdErr}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              /* Diagnostics Tab */
              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-3 rounded-md bg-zinc-950 border border-zinc-800/80 space-y-2">
                  <div className="text-zinc-500 text-[10px] uppercase font-semibold">Execution Info</div>
                  <div className="grid grid-cols-2 gap-2 text-zinc-400">
                    <div>
                      <span className="text-zinc-600 block text-[10px]">SUBMISSION ID</span>
                      <span className="text-zinc-300 select-all">{currentSubmissionId || "none"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[10px]">RUNTIME</span>
                      <span className="text-zinc-300 capitalize">{selectedLanguage}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[10px]">QUEUE</span>
                      <span className="text-zinc-300">Redis Stream</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[10px]">TIME</span>
                      <span className="text-zinc-300">
                        {elapsedTime !== null ? `${(elapsedTime / 1000).toFixed(3)}s` : "none"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Status Line */}
            <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
              <span>{BACKEND_URL}</span>
              <span>{currentSubmissionId ? `sub:${currentSubmissionId.slice(0, 8)}` : "ready"}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;