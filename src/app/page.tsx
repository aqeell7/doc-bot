
"use client";

import { useState } from "react";

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!question.trim() || busy) return;

    setBusy(true);
    setAnswer("");
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

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        // your drill line (4)
        const { done, value } = await reader.read();

        // your drill line (5)
        if (done) break;

        // your drill line (6)
        text += decoder.decode(value, { stream: true });
        setAnswer(text);

        if (firstPieceAt === null) {
          firstPieceAt = Date.now();
          setStatus("Writing...");
        }
      }

      const firstMs =
        firstPieceAt === null ? "-" : `${firstPieceAt - started} ms`;

      setStatus(
        `first words after ${firstMs} · done after ${Date.now() - started} ms`
      );
    } catch {
      setStatus("Network error. Is `npm run dev` still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{ maxWidth: 720, margin: "40px auto", padding: "0 16px" }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>
        Nimbus Doc Bot
      </h1>

      <p style={{ color: "#666", marginTop: 0 }}>
        Ask anything about the Nimbus Notes handbook.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
          }}
          placeholder="e.g. Can I get a refund on yearly Plus?"
          style={{
            flex: 1,
            padding: "10px 12px",
            fontSize: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        />

        <button
          onClick={ask}
          disabled={busy}
          style={{
            padding: "10px 16px",
            fontSize: 16,
            borderRadius: 8,
            border: "none",
            background: busy ? "#999" : "#2563eb",
            color: "white",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "..." : "Ask"}
        </button>
      </div>

      <p style={{ color: "#888", fontSize: 13, minHeight: 18 }}>
        {status}
      </p>

      {answer && (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}
        >
          {answer}
        </div>
      )}
    </main>
  );
}
