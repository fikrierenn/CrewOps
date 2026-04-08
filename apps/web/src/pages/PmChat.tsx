import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProjects, sendPmChat, fetchChatHistory } from "../api";
import type { Project, ChatMessage } from "../api";

export function PmChat() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutabakatReady, setMutabakatReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects()
      .then((list) => {
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      fetchChatHistory(selectedProjectId)
        .then(setMessages)
        .catch(() => setMessages([]));
      const project = projects.find((p) => p.id === selectedProjectId);
      setMutabakatReady(project?.phase === "mutabakat_tamamlandi" || project?.phase === "planlama" || project?.phase === "gelistirme");
    }
  }, [selectedProjectId, projects]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedProjectId || loading) return;
    const userMsg = input.trim();
    setInput("");
    setError(null);
    setLoading(true);

    // Optimistic: kullanici mesajini hemen goster
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), projectId: selectedProjectId, role: "user" as const, content: userMsg, createdAt: new Date().toISOString() }
    ]);

    try {
      const result = await sendPmChat(selectedProjectId, userMsg);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, projectId: selectedProjectId, role: "pm" as const, content: result.pmReply, createdAt: new Date().toISOString() }
      ]);
      if (result.mutabakatReady) {
        setMutabakatReady(true);
        // Proje listesini guncelle
        fetchProjects().then(setProjects).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-100">PM Sohbet</h2>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="" disabled>Proje sec...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>#{p.id} {p.name}</option>
            ))}
          </select>
        </div>
        {selectedProject && (
          <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
            {selectedProject.phase}
          </span>
        )}
      </div>

      {/* Mutabakat Banner */}
      {mutabakatReady && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-700/60 bg-emerald-950/40 p-3">
          <div>
            <p className="font-medium text-emerald-200">Mutabakat tamamlandi!</p>
            <p className="text-sm text-emerald-400">Plan olusturmaya gecebilirsiniz.</p>
          </div>
          <button
            onClick={() => navigate("/plan", { state: { projectId: selectedProjectId } })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Plana Gec
          </button>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center text-slate-500">
            <p>PM ile sohbet baslatmak icin bir mesaj gonderin.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-700/80 text-slate-200"
                }`}
              >
                {msg.role !== "user" && (
                  <div className="mb-1 text-xs font-medium text-indigo-400">PM</div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className="mt-1 text-right text-[10px] opacity-50">
                  {new Date(msg.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-slate-700/80 px-4 py-3 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-indigo-400"></div>
                  PM dusunuyor...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedProjectId ? "Mesajinizi yazin... (Enter ile gonderin)" : "Once bir proje secin"}
          disabled={!selectedProjectId || loading}
          rows={2}
          className="flex-1 resize-none rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !selectedProjectId || loading}
          className="self-end rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Gonder
        </button>
      </div>
    </div>
  );
}
