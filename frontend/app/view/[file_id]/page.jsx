"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppContext } from "@/context/context";
import Link from "next/link";
import { ArrowLeft, Download, File } from "lucide-react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function FileViewerPage() {
  const { file_id } = useParams();
  const router = useRouter();
  const { token, isLoggedIn, hydrated } = useAppContext();

  const [meta, setMeta] = useState(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [textContent, setTextContent] = useState("");

  // AI: summary and Q&A
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAnswer, setChatAnswer] = useState("");

  const ext = useMemo(() => {
    const name = meta?.file_name || "";
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
  }, [meta]);

  const guessedType = useMemo(() => {
    if (["png","jpg","jpeg","gif","webp","bmp","svg"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
    if (["mp4","webm","ogg"].includes(ext)) return `video/${ext}`;
    if (["mp3","wav","ogg"].includes(ext)) return ext === "mp3" ? "audio/mpeg" : `audio/${ext}`;
    if (["pdf"].includes(ext)) return "application/pdf";
    if (["txt","md","csv","json","log","js","ts","jsx","tsx","py","java","c","cpp","go","rb","php","sh","html","css"].includes(ext)) return "text/plain";
    if (["doc","docx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (["ppt","pptx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (["xls","xlsx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/octet-stream";
  }, [ext]);

  const isImage = guessedType.startsWith("image/");
  const isVideo = guessedType.startsWith("video/");
  const isAudio = guessedType.startsWith("audio/");
  const isPDF = guessedType === "application/pdf";
  const isText = guessedType.startsWith("text/");
  const isOffice = ["doc","docx","ppt","pptx","xls","xlsx"].includes(ext);
  const isCode = ["js","ts","jsx","tsx","py","java","c","cpp","go","rb","php","sh","html","css","json","md"].includes(ext);

  const monacoLanguage = useMemo(() => {
    const map = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      h: "cpp",
      go: "go",
      rb: "ruby",
      php: "php",
      sh: "shell",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      log: "plaintext",
      txt: "plaintext",
      csv: "plaintext",
    };

    return map[ext] || "plaintext";
  }, [ext]);

  // --- AI: Fetch summary ---
  const fetchSummary = async () => {
    setAiLoading(true);
    setAiError("");
    setAiSummary("");
    try {
      const form = new FormData();
      form.append("file_id", String(file_id));
      const resp = await fetch("http://127.0.0.1:8000/ai/summarize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || data?.message || "Failed to summarize");
      setAiSummary(data.summary || "No summary returned.");
    } catch (e) {
      setAiError(e?.message || "Summarization failed");
    } finally {
      setAiLoading(false);
    }
  };

  // --- AI: Ask a question ---
  const askAI = async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    setChatAnswer("");
    try {
      const form = new FormData();
      form.append("file_id", String(file_id));
      form.append("question", chatQuestion);
      const resp = await fetch("http://127.0.0.1:8000/ai/ask", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.detail || data?.message || "Ask failed");
      setChatAnswer(data.answer || "No answer.");
    } catch (e) {
      setChatAnswer("");
      alert(e?.message || "Ask failed");
    } finally {
      setChatLoading(false);
    }
  };

  // 1) Fetch metadata first
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!hydrated) return;
      if (!token || !isLoggedIn) { router.push("/login"); return; }
      try {
        setLoading(true);
        setError("");
        setTextContent("");
        setBlobUrl("");
        const metaRes = await fetch(`http://127.0.0.1:8000/files/file_metadata?file_id=${encodeURIComponent(file_id)}` , {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(()=>({}));
          throw new Error(err?.detail || err?.message || "Unable to load file metadata");
        }
        const m = await metaRes.json();
        if (cancelled) return;
        setMeta(m);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load file");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [file_id, hydrated, token, isLoggedIn, router]);

  // 2) When metadata is available (ext known), fetch content appropriately
  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    let currentUrl = "";
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setTextContent("");
        setBlobUrl("");
        const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file_id}` , {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(()=>({}));
          throw new Error(err?.detail || err?.message || "Unable to load file contents");
        }
        if (isText || isCode) {
          const text = await res.text();
          if (cancelled) return;
          setTextContent(text);
        } else {
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          const blob = new Blob([buf], { type: guessedType });
          currentUrl = URL.createObjectURL(blob);
          setBlobUrl(currentUrl);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load file contents");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [meta, file_id, token, isText, isCode, guessedType]);

  const runnableExt = ["js","ts","py","java","c","cpp","go","rb","php","sh"];
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const langId = useMemo(() => {
    const m = { js: 63, ts: 74, py: 71, java: 62, c: 50, cpp: 54, go: 60, rb: 72, php: 68, sh: 46 };
    return m[ext];
  }, [ext]);

  const b64 = (s) => {
    try { return btoa(unescape(encodeURIComponent(s))); } catch { return btoa(s); }
  };

  const runCode = async () => {
    if (!runnableExt.includes(ext) || !textContent) return;
    setRunning(true);
    setRunResult(null);
    try {
      const form = new FormData();
      form.append("file_id", String(file_id));
      form.append("stdin", stdin || "");
      const resp = await fetch("http://127.0.0.1:8000/execute/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.detail || data?.message || "Run failed");
      }
      setRunResult(data);
    } catch (e) {
      setRunResult({ error: e?.message || "Run failed" });
    } finally {
      setRunning(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "—";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    if (kb >= 1) return `${kb.toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleString();
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        throw new Error(err?.detail || err?.message || "Download failed");
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta?.file_name || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || "Download failed");
    }
  };

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded hover:bg-gray-100" title="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-lg font-semibold truncate" title={meta?.file_name || "File Viewer"}>
              {meta?.file_name || "File Viewer"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isCode && runnableExt.includes(ext) && (
              <button
                onClick={runCode}
                disabled={running || !textContent}
                className={`px-3 py-1.5 ${running ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded`}
              >
                {running ? 'Running…' : 'Run'}
              </button>
            )}
            <button onClick={handleDownload} className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Info */}
        {meta && (
          <div className="bg-white border rounded p-4 text-sm grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-gray-500">Type</div>
              <div>{ext || "Unknown"}</div>
            </div>
            <div>
              <div className="text-gray-500">Size</div>
              <div>{formatFileSize(meta.file_size)}</div>
            </div>
            <div>
              <div className="text-gray-500">Modified</div>
              <div>{formatDate(meta.updated_at)}</div>
            </div>
            <div>
              <div className="text-gray-500">Created</div>
              <div>{formatDate(meta.created_at)}</div>
            </div>
          </div>
        )}

        {/* AI Summary */}
        <div className="bg-white border rounded p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">AI Summary</div>
            <button
              onClick={fetchSummary}
              disabled={aiLoading}
              className={`px-3 py-1.5 rounded text-white ${aiLoading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {aiLoading ? 'Summarizing…' : 'Summarize'}
            </button>
          </div>
          <div className="mt-3 text-sm whitespace-pre-wrap">
            {aiError ? (
              <span className="text-red-600">{aiError}</span>
            ) : aiSummary ? (
              aiSummary
            ) : (
              <span className="text-gray-500">Click Summarize to generate a concise summary of this file.</span>
            )}
          </div>
        </div>

        {/* AI Q&A */}
        <div className="bg-white border rounded p-4">
          <div className="text-sm font-medium mb-2">Ask about this file</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatQuestion}
              onChange={(e)=>setChatQuestion(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button
              onClick={askAI}
              disabled={chatLoading || !chatQuestion.trim()}
              className={`px-3 py-2 rounded text-white ${chatLoading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {chatLoading ? 'Asking…' : 'Ask'}
            </button>
          </div>
          {chatAnswer && (
            <div className="mt-3 text-sm whitespace-pre-wrap border rounded p-3 bg-gray-50">{chatAnswer}</div>
          )}
        </div>

        {isCode && runnableExt.includes(ext) && (
          <div className="bg-white border rounded p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Standard Input</div>
              <textarea
                value={stdin}
                onChange={(e)=>setStdin(e.target.value)}
                className="w-full h-40 border rounded p-2 font-mono text-sm"
                placeholder="Enter input for the program"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={runCode}
                  disabled={running || !textContent}
                  className={`px-3 py-1.5 ${running ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded`}
                >
                  {running ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Output</div>
              <div className="w-full h-40 border rounded p-2 bg-gray-50 overflow-auto text-sm font-mono whitespace-pre-wrap">
                {runResult ? (
                  runResult.error ? (
                    <span className="text-red-600">{runResult.error}</span>
                  ) : (
                    <>
                      {runResult.stdout && <div>{atob(runResult.stdout)}</div>}
                      {runResult.stderr && <div className="text-red-600">{atob(runResult.stderr)}</div>}
                      {runResult.compile_output && <div className="text-orange-600">{atob(runResult.compile_output)}</div>}
                      {!runResult.stdout && !runResult.stderr && !runResult.compile_output && (
                        <div className="text-gray-500">No output.</div>
                      )}
                    </>
                  )
                ) : (
                  <div className="text-gray-500">Run to see output.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Viewer */}
        <div className="bg-white border rounded p-4 min-h-[300px] flex items-center justify-center">
          {loading ? (
            <div className="text-gray-600 text-sm">Loading…</div>
          ) : error ? (
            <div className="text-center">
              <File className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          ) : (
            (isCode && textContent) ? (
              <div className="w-full h-[80vh]">
                <MonacoEditor
                  height="100%"
                  defaultLanguage={monacoLanguage}
                  theme="vs-dark"
                  value={textContent}
                  options={{ readOnly: true, wordWrap: "on", minimap: { enabled: false } }}
                />
              </div>
            ) : (isText && textContent) ? (
              <pre className="w-full max-h-[80vh] overflow-auto whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded">{textContent}</pre>
            ) : blobUrl ? (
              isImage ? (
                <img src={blobUrl} alt={meta?.file_name || "image"} className="max-w-full max-h-[80vh] object-contain" />
              ) : isPDF ? (
                <iframe src={blobUrl} title="PDF preview" className="w-full h-[80vh]" />
              ) : isVideo ? (
                <video controls src={blobUrl} className="max-w-full max-h-[80vh]" />
              ) : isAudio ? (
                <audio controls src={blobUrl} className="w-full" />
              ) : isText ? (
                <div className="text-gray-600 text-sm">No text content available.</div>
              ) : isOffice ? (
                <div className="text-center text-sm text-gray-700">
                  <div className="mb-2">This {ext.toUpperCase()} file type currently doesn't have an inline preview.</div>
                  <div>Click Download to open it in your desktop app.</div>
                </div>
              ) : (
                <div className="text-center text-sm text-gray-700">Preview not available for this file type.</div>
              )
            ) : (
              <div className="text-gray-600 text-sm">No preview available.</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
