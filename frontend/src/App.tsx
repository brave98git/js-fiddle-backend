import axios from "axios";
import { Button } from "./components/ui/button";
import "./index.css";
import  {useState } from "react";
import { Play, Code2, Terminal, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

const BACKEND_URL = "http://localhost:3000";

export function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<"c++" | "javascript" | "python">("c++");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "ACCEPTED" | "REJECTED" | "ERROR">("IDLE");
  const [output, setOutput] = useState("");
  const [currentSubmissionId, setCurrentSubmissionId] = useState<string | null>(null);

  const handleLanguageChange = (lang: "c++" | "javascript" | "python") => {
    setSelectedLanguage(lang);
  };

  const runCode = async () => {
    setStatus("PENDING");
    setOutput("");
    try {
      const response = await axios.post(`${BACKEND_URL}/submission`, {
        code,
        language: selectedLanguage
      });

      const subId = response.data.submissionId;
      if (!subId) {
        setStatus("ERROR");
        setOutput("Failed to retrieve submission ID from backend.");
        return;
      }
      setCurrentSubmissionId(subId);
      pollBackend(subId);
    } catch (err: any) {
      console.error(err);
      setStatus("ERROR");
      setOutput(err?.response?.data?.message || "Failed to submit code to the execution environment.");
    }
  };

  const pollBackend = async (submissionId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max poll duration

    const checkStatus = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/submission/${submissionId}`);
        const data = response.data;

        if (data.status === "PENDING") {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 1000);
          } else {
            setStatus("ERROR");
            setOutput("Execution timed out. Please try again.");
          }
        } else {
          setStatus(data.status);
          setOutput(data.output || "Program finished with no output.");
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        setStatus("ERROR");
        setOutput("Error communicating with execution server.");
      }
    };

    setTimeout(checkStatus, 1000);
  };

  return (
    <div className="dark min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500/30">
      
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#1D4ED8] p-2 rounded-xl text-white shadow-lg shadow-blue-700/20">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              FIDDLE
            </h1>
            <p className="text-xs text-slate-400 font-medium">Asynchronous Code Sandbox</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => handleLanguageChange("c++")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedLanguage === "c++"
                  ? "bg-[#1D4ED8] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              C++
            </button>
            <button
              onClick={() => handleLanguageChange("javascript")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedLanguage === "javascript"
                  ? "bg-[#1D4ED8] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => handleLanguageChange("python")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedLanguage === "python"
                  ? "bg-[#1D4ED8] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Python
            </button>
          </div>

          <Button
            onClick={runCode}
            disabled={status === "PENDING"}
            className="bg-[#1D4ED8] hover:bg-blue-600 text-white shadow-md shadow-blue-700/10 gap-2 font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {status === "PENDING" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                Run Code
              </>
            )}
          </Button>
        </div>
      </header>

      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Panel */}
        <div className="flex-1 flex flex-col min-h-[40vh] md:min-h-0 border-r border-slate-800 bg-slate-900/10">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/30">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-blue-400" />
              Source Code
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {selectedLanguage === "c++" && "main.cpp"}
              {selectedLanguage === "javascript" && "index.js"}
              {selectedLanguage === "python" && "main.py"}
            </span>
          </div>
          <div className="flex-1 relative flex">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 p-4 bg-transparent resize-none outline-none font-mono text-sm leading-6 text-slate-200 selection:bg-blue-500/25"
              placeholder="// Write your code here..."
            />
          </div>
        </div>

        {/* Terminal/Output Panel */}
        <div className="flex-1 flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/20">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              Execution Output
            </span>

            {/* Status pill */}
            <div className="flex items-center gap-1.5">
              {status === "IDLE" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Ready
                </span>
              )}
              {status === "PENDING" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  Queued / Running
                </span>
              )}
              {status === "ACCEPTED" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Accepted
                </span>
              )}
              {status === "REJECTED" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Rejected / Compilation Failed
                </span>
              )}
              {status === "ERROR" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 p-6 font-mono text-sm leading-6 overflow-auto bg-slate-950/60 flex flex-col justify-between">
            {output ? (
              <pre className={`whitespace-pre-wrap ${status === "REJECTED" ? "text-rose-400" : "text-emerald-300"}`}>
                {output}
              </pre>
            ) : status === "PENDING" ? (
              <div className="text-slate-500 italic animate-pulse">Waiting for the background worker to execute code...</div>
            ) : status === "IDLE" ? (
              <div className="text-slate-600 italic">Press "Run Code" to compile and run your code asynchronously using Redis queue.</div>
            ) : (
              <div className="text-slate-500 italic">No output produced.</div>
            )}

            {currentSubmissionId && (
              <div className="mt-8 pt-4 border-t border-slate-900/60 text-[10px] text-slate-600 flex items-center justify-between">
                <span>SUBMISSION_ID: {currentSubmissionId}</span>
                <span>ASYNCHRONOUS WORKER QUEUE</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;