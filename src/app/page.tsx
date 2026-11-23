"use client";

import { useState } from "react";
import { parseCitations, SourceInfo } from "../lib/citations";
import { REFUSAL } from "../lib/refusal";

const MAX_QUESTION_LENGTH = 1000;

// Sources travel in the X-Sources header as packed JSON. Anything broken → no sources.
function readSources(res: Response): SourceInfo[] {
  try {
    return JSON.parse(decodeURIComponent(res.headers.get("X-Sources") ?? "[]"));
  } catch {
    return [];
  }
}

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [openSource, setOpenSource] = useState<number | null>(null); // which source is expanded
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!question.trim() || busy) return;
    setBusy(true);
    setAnswer("");
    setSources([]);
    setOpenSource(null);
    setStatus("Searching the docs...");
    const started = Date.now();
    let firstPieceAt: number | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setStatus(data?.error ?? `Error ${res.status}`);
        return;
      }
      setSources(readSources(res)); // read the label before reading the letter

      // your S4 reading loop, unchanged
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);

        if (firstPieceAt === null) {
          firstPieceAt = Date.now();
          setStatus("Writing...");
        }
      }

      const firstMs = firstPieceAt === null ? "-" : `${firstPieceAt - started} ms`;
      setStatus(`first words after ${firstMs} · done after ${Date.now() - started} ms`);
    } catch {
      setStatus("Network error. Is `npm run dev` still running?");
    } finally {
      setBusy(false);
    }
  }

  // Worked out fresh on every redraw (so it updates while the answer streams in):
  const refused = answer.trim() === REFUSAL;
  const parts = parseCitations(answer, sources.length);
  const cited = new Set(parts.flatMap((p) => (p.kind === "cite" && p.valid ? [p.n] : [])));

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Nimbus Doc Bot</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Ask anything about the Nimbus Notes handbook.</p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={question}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          placeholder="e.g. Can I get a refund on yearly Plus?"
          style={{ flex: 1, padding: "10px 12px", fontSize: 16, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <button
          onClick={ask}
          disabled={busy || !question.trim()}
          style={{ padding: "10px 16px", fontSize: 16, borderRadius: 8, border: "none",
                   background: busy || !question.trim() ? "#999" : "#2563eb", color: "white",
                   cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "..." : "Ask"}
        </button>
      </div>
      <p style={{ color: "#888", fontSize: 13, margin: "6px 0 0", minHeight: 18 }}>
        {status}
        <span style={{ float: "right" }}>{question.length}/{MAX_QUESTION_LENGTH}</span>
      </p>

      {/* Refusal: a friendly box instead of an answer */}
      {refused && (
        <div style={{ marginTop: 12, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 16 }}>
          <strong>I couldn&apos;t find this in the documents.</strong>
          <div style={{ color: "#666", marginTop: 4 }}>
            Try asking about plans, billing, refunds, sharing, syncing, security or your account.
          </div>
        </div>
      )}

      {/* The answer: text pieces + clickable [n] buttons */}
      {answer && !refused && (
        <div style={{ marginTop: 12, background: "white", border: "1px solid #e5e7eb", borderRadius: 8,
                      padding: 16, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {parts.map((p, i) =>
            p.kind === "text" ? (
              <span key={i}>{p.text}</span>
            ) : p.valid ? (
              <button
                key={i}
                onClick={() => setOpenSource(p.n)}
                title={`Show source ${p.n}`}
                style={{ border: "none", background: openSource === p.n ? "#2563eb" : "#dbeafe",
                         color: openSource === p.n ? "white" : "#1e40af", borderRadius: 4,
                         padding: "0 5px", margin: "0 1px", fontSize: 12, cursor: "pointer" }}
              >
                {p.n}
              </button>
            ) : (
              <span key={i} title="This citation doesn't match any source"
                    style={{ color: "#b91c1c", fontSize: 12 }}>[{p.n}?]</span>
            )
          )}
        </div>
      )}

      {/* The sources: cited ones bright, uncited ones faded; click to see the passage */}
      {sources.length > 0 && answer && !refused && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Sources</div>
          {sources.map((s) => (
            <div
              key={s.n}
              onClick={() => setOpenSource(openSource === s.n ? null : s.n)}
              style={{ background: "white", border: `1px solid ${openSource === s.n ? "#2563eb" : "#e5e7eb"}`,
                       borderRadius: 8, padding: "8px 12px", marginBottom: 6, cursor: "pointer",
                       opacity: cited.has(s.n) ? 1 : 0.55 }}
            >
              <div style={{ fontSize: 14 }}>
                <strong>[{s.n}]</strong> {s.source}{s.page ? `, page ${s.page}` : ""} · chunk {s.position}
                {!cited.has(s.n) && <span style={{ color: "#999" }}> · not cited</span>}
              </div>
              {openSource === s.n && (
                <div style={{ fontSize: 13, color: "#444", marginTop: 6, whiteSpace: "pre-wrap" }}>
                  {s.snippet}…
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}