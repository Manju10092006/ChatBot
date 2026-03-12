import { useState, useRef, useEffect, useCallback } from "react";

// ── Sub-components ───────────────────────────────────────────────────────────

function AuraIcon({ size = 18, color = "#7B5C3A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill={color} opacity="0.9" />
      <path d="M19 16L19.9 18.1L22 19L19.9 19.9L19 22L18.1 19.9L16 19L18.1 18.1L19 16Z" fill={color} opacity="0.5" />
      <path d="M5 4L5.6 5.4L7 6L5.6 6.6L5 8L4.4 6.6L3 6L4.4 5.4L5 4Z" fill={color} opacity="0.5" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div style={S.typingRow}>
      <div style={S.botAvatar}><AuraIcon size={14} /></div>
      <div style={S.typingBubble}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ ...S.dot, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  const isImg = file.type.startsWith("image/");
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (isImg) {
      const r = new FileReader();
      r.onload = (e) => setSrc(e.target.result);
      r.readAsDataURL(file);
    }
  }, [file, isImg]);
  return (
    <div style={S.fileChip}>
      {isImg && src ? <img src={src} alt="" style={S.fileThumb} /> : <span style={{ fontSize: 18 }}>📄</span>}
      <span style={S.fileName}>{file.name.length > 18 ? file.name.slice(0, 15) + "…" : file.name}</span>
      <button style={S.fileRemove} onClick={onRemove}>✕</button>
    </div>
  );
}

export function Message({ msg, idx, speakMsg, speaking, speakingIdx }) {
  const isUser = msg.role === "user";
  const isSpeaking = speaking && speakingIdx === idx;
  return (
    <div style={{
      ...S.msgRow, justifyContent: isUser ? "flex-end" : "flex-start",
      animation: `msgIn 0.4s cubic-bezier(.22,.68,0,1.25) both`, animationDelay: `${idx * 0.03}s`
    }}>
      {!isUser && <div style={S.botAvatar}><AuraIcon size={14} /></div>}
      <div style={{ ...S.bubble, ...(isUser ? S.userBubble : S.botBubble) }}>
        {msg.imageUrl && <img src={msg.imageUrl} alt="upload" style={S.msgImage} />}
        {msg.fileName && !msg.imageUrl && (
          <div style={S.msgFile}><span>📄</span><span style={{ fontSize: 12 }}>{msg.fileName}</span></div>
        )}
        <span style={S.bubbleTxt}>{msg.content}</span>
        {!isUser && (
          <button style={{ ...S.ttsBtn, color: isSpeaking ? "#C4973A" : "#A89070" }}
            onClick={() => speakMsg(msg.content, idx)} title={isSpeaking ? "Stop" : "Read aloud"}>
            {isSpeaking
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
            }
          </button>
        )}
      </div>
      {isUser && <div style={S.userAvatar}>U</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chatbot component
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_QUICK_ACTIONS = [
  { icon: "⚡", label: "Code Helper", prompt: "Help me write better, cleaner code with best practices" },
  { icon: "🎨", label: "Create & Design", prompt: "Help me brainstorm a creative design concept" },
  { icon: "📖", label: "Explain Anything", prompt: "Explain a complex topic in simple, beautiful language" },
  { icon: "✦", label: "Surprise Me", prompt: "Share something fascinating I probably don't know" },
];

const DEFAULT_SUGGESTIONS = [
  "What is quantum entanglement?",
  "Write me a Python web scraper",
  "Give me a morning routine",
  "Explain neural networks",
];

export default function Chatbot({
  apiUrl = "http://localhost:5000/chat",
  botName = "Aura",
  quickActions = DEFAULT_QUICK_ACTIONS,
  suggestions = DEFAULT_SUGGESTIONS,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakIdx, setSpeakIdx] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const recogRef = useRef(null);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // ── Voice recognition ───────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input not supported in this browser."); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = true; r.continuous = false;
    r.onresult = (e) => {
      const t = Array.from(e.results).map((x) => x[0].transcript).join("");
      setInput(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  // ── TTS ─────────────────────────────────────────────────────────────────
  const speakMsg = useCallback((text, idx) => {
    const synth = synthRef.current;
    if (!synth) return;
    if (synth.speaking) { synth.cancel(); setSpeaking(false); setSpeakIdx(null); if (speakIdx === idx) return; }
    if (!soundOn) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1; u.pitch = 1;
    const voices = synth.getVoices();
    const preferred = voices.find((v) => v.name.includes("Google") && v.lang === "en-US") || voices[0];
    if (preferred) u.voice = preferred;
    u.onstart = () => { setSpeaking(true); setSpeakIdx(idx); };
    u.onend = u.onerror = () => { setSpeaking(false); setSpeakIdx(null); };
    synth.speak(u);
  }, [soundOn, speakIdx]);

  // ── File handling ───────────────────────────────────────────────────────
  const handleFiles = (fileList) => {
    const arr = Array.from(fileList).slice(0, 4);
    setFiles((p) => [...p, ...arr].slice(0, 4));
  };

  // ── Send message (via backend API) ──────────────────────────────────────
  async function sendMessage(text) {
    const userText = (text || input).trim();
    if ((!userText && files.length === 0) || loading) return;
    setInput(""); setError(null);
    if (!started) setStarted(true);

    let imageUrl = null, fileName = null;
    if (files.length > 0) {
      const f = files[0];
      if (f.type.startsWith("image/")) {
        imageUrl = await new Promise((res) => { const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(f); });
      } else { fileName = f.name; }
    }
    const pendingFiles = [...files];
    setFiles([]);

    const displayContent = userText || (pendingFiles[0]?.name ? `[File: ${pendingFiles[0].name}]` : "[Image]");
    const newMessages = [...messages, { role: "user", content: displayContent, imageUrl, fileName }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Send only role + content to the backend
      const apiMsgs = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMsgs }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const reply = data.reply || "I couldn't generate a response.";
      const finalMsgs = [...newMessages, { role: "assistant", content: reply }];
      setMessages(finalMsgs);
      if (soundOn) speakMsg(reply, finalMsgs.length - 1);
    } catch (e) {
      setError(e.message || "Network error — please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={S.root}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}>
      <style>{CSS}</style>
      <div style={S.blob1} /><div style={S.blob2} /><div style={S.blob3} />

      <div style={{ ...S.card, ...(dragOver ? S.cardDrag : {}) }}>
        {dragOver && <div style={S.dropOverlay}>Drop files here ✦</div>}

        {/* Header */}
        <header style={S.header}>
          <div style={S.hLeft}>
            <div style={S.logo}><AuraIcon size={22} color="#FAF3E8" /></div>
            <div>
              <div style={S.hTitle}>{botName} <span style={S.hBadge}>AI</span></div>
              <div style={S.hSub}><span style={S.dot2} />Always on</div>
            </div>
          </div>
          <div style={S.hRight}>
            <button style={{ ...S.hBtn, ...(soundOn ? S.hBtnOn : {}) }}
              onClick={() => { synthRef.current?.cancel(); setSpeaking(false); setSoundOn((p) => !p); }}
              title={soundOn ? "Mute TTS" : "Enable TTS"}>
              {soundOn
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>}
            </button>
            <button style={S.hBtn} title="New chat"
              onClick={() => { synthRef.current?.cancel(); setMessages([]); setStarted(false); setFiles([]); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </header>

        {/* Body */}
        <div style={S.body}>
          {!started ? (
            <div style={S.welcome}>
              <div style={S.heroWrap}>
                <div style={S.heroRing1} /><div style={S.heroRing2} />
                <div style={S.heroCore}><AuraIcon size={36} color="#FAF3E8" /></div>
              </div>
              <h1 style={S.wTitle}>Hello, I'm <em>{botName}.</em></h1>
              <p style={S.wSub}>Your refined AI companion — ask anything, upload files,<br />speak freely or type away.</p>
              <div style={S.quickGrid}>
                {quickActions.map((q, i) => (
                  <button key={i} style={S.qCard}
                    onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-4px) scale(1.02)"}
                    onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
                    onClick={() => sendMessage(q.prompt)}>
                    <span style={S.qIcon}>{q.icon}</span>
                    <span style={S.qLabel}>{q.label}</span>
                  </button>
                ))}
              </div>
              <div style={S.chips}>
                {suggestions.map((s, i) => (
                  <button key={i} style={S.chip} onClick={() => sendMessage(s)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#E8DDD0"; e.currentTarget.style.color = "#4A3728"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A89070"; }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={S.msgList}>
              {messages.map((m, i) => (
                <Message key={i} msg={m} idx={i} speakMsg={speakMsg} speaking={speaking} speakingIdx={speakIdx} />
              ))}
              {loading && <TypingDots />}
              {error && <div style={S.errMsg}>⚠ {error}</div>}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={S.inputArea}>
          {files.length > 0 && (
            <div style={S.filePreviews}>
              {files.map((f, i) => (
                <FileChip key={i} file={f} onRemove={() => setFiles((p) => p.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          {started && (
            <div style={S.suggRow}>
              {suggestions.slice(0, 3).map((s, i) => (
                <button key={i} style={S.chipSm} onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          )}
          <div style={S.bar}>
            <button style={S.barBtn} title="Attach file or image" onClick={() => fileRef.current?.click()}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input ref={fileRef} type="file" multiple accept="*/*" style={{ display: "none" }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

            <textarea ref={inputRef} value={input} rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Message ${botName}…`}
              style={S.ta} />

            <button style={{ ...S.barBtn, ...(listening ? S.barBtnActive : {}) }}
              title={listening ? "Stop listening" : "Voice input"}
              onMouseDown={() => { listening ? stopListening() : startListening(); }}>
              {listening
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#C4973A" stroke="#C4973A" strokeWidth="1"><rect x="9" y="4" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" fill="none" strokeWidth="2" /><line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" /></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>}
            </button>

            <button
              style={{ ...S.sendBtn, ...((input.trim() || files.length > 0) ? S.sendBtnOn : {}) }}
              onClick={() => sendMessage()}
              disabled={(!input.trim() && files.length === 0) || loading}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div style={S.footNote}>{botName} · Powered by Gemini · Your data stays private</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ STYLES ═══════════════════════════════════════════════
const S = {
  root: { fontFamily: "'Cormorant Garamond','Playfair Display',Georgia,serif", background: "#F5F0E8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", position: "relative", overflow: "hidden" },
  blob1: { position: "fixed", top: "-15%", left: "-10%", width: "520px", height: "520px", borderRadius: "50%", background: "radial-gradient(circle,rgba(196,151,58,0.12) 0%,transparent 70%)", animation: "blobDrift 18s ease-in-out infinite", pointerEvents: "none" },
  blob2: { position: "fixed", bottom: "-10%", right: "-8%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle,rgba(168,144,112,0.1) 0%,transparent 70%)", animation: "blobDrift 22s ease-in-out infinite reverse", pointerEvents: "none" },
  blob3: { position: "fixed", top: "40%", left: "40%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle,rgba(245,240,232,0.6) 0%,transparent 70%)", pointerEvents: "none" },
  card: { width: "100%", maxWidth: "740px", height: "calc(100vh - 32px)", maxHeight: "880px", background: "rgba(250,247,241,0.92)", backdropFilter: "blur(32px)", border: "1px solid rgba(196,151,58,0.18)", borderRadius: "32px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 80px rgba(100,70,40,0.12), 0 4px 24px rgba(196,151,58,0.1), inset 0 1px 0 rgba(255,255,255,0.9)", position: "relative" },
  cardDrag: { border: "2px dashed rgba(196,151,58,0.5)", background: "rgba(250,247,241,0.98)" },
  dropOverlay: { position: "absolute", inset: 0, background: "rgba(250,247,241,0.95)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontStyle: "italic", color: "#C4973A", letterSpacing: "0.05em", borderRadius: "32px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(196,151,58,0.12)", background: "rgba(255,255,255,0.4)" },
  hLeft: { display: "flex", alignItems: "center", gap: "13px" },
  logo: { width: "46px", height: "46px", borderRadius: "16px", background: "linear-gradient(135deg,#8B5E3C,#C4973A)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(196,151,58,0.35)" },
  hTitle: { fontSize: "18px", fontWeight: "600", color: "#3D2B1A", letterSpacing: "-0.01em", fontStyle: "normal" },
  hBadge: { fontSize: "10px", fontFamily: "'DM Sans','Gill Sans',sans-serif", fontWeight: "600", letterSpacing: "0.12em", background: "linear-gradient(90deg,#C4973A,#8B5E3C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textTransform: "uppercase", verticalAlign: "middle", marginLeft: "4px" },
  hSub: { fontSize: "11px", color: "#A89070", display: "flex", alignItems: "center", gap: "5px", marginTop: "2px", fontFamily: "'DM Sans','Gill Sans',sans-serif" },
  dot2: { display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 6px #4CAF50" },
  hRight: { display: "flex", gap: "8px" },
  hBtn: { background: "rgba(196,151,58,0.08)", border: "1px solid rgba(196,151,58,0.2)", borderRadius: "12px", color: "#A89070", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" },
  hBtnOn: { background: "rgba(196,151,58,0.15)", color: "#C4973A", borderColor: "rgba(196,151,58,0.4)", boxShadow: "0 0 10px rgba(196,151,58,0.2)" },
  body: { flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" },
  welcome: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px", gap: "22px", animation: "fadeUp 0.7s ease both" },
  heroWrap: { position: "relative", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center" },
  heroCore: { width: "76px", height: "76px", borderRadius: "24px", background: "linear-gradient(135deg,#8B5E3C,#C4973A,#D4AF70)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(196,151,58,0.45)", animation: "pulse2 3s ease-in-out infinite", position: "relative", zIndex: 2 },
  heroRing1: { position: "absolute", width: "96px", height: "96px", border: "2px solid rgba(196,151,58,0.3)", borderRadius: "28px", animation: "ringPop 2.8s ease-out infinite" },
  heroRing2: { position: "absolute", width: "96px", height: "96px", border: "2px solid rgba(139,94,60,0.2)", borderRadius: "28px", animation: "ringPop 2.8s ease-out infinite 1.4s" },
  wTitle: { fontSize: "38px", fontWeight: "700", color: "#2C1A0E", letterSpacing: "-0.02em", textAlign: "center", fontStyle: "normal", lineHeight: 1.1 },
  wSub: { fontSize: "15px", color: "#8A7060", textAlign: "center", lineHeight: 1.7, maxWidth: "360px", fontFamily: "'DM Sans','Gill Sans',sans-serif", fontWeight: "400" },
  quickGrid: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "10px", width: "100%", maxWidth: "440px" },
  qCard: { background: "rgba(255,255,255,0.7)", border: "1px solid rgba(196,151,58,0.15)", borderRadius: "18px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer", transition: "all 0.3s cubic-bezier(.22,.68,0,1.25)", textAlign: "left", boxShadow: "0 2px 12px rgba(100,70,40,0.06)" },
  qIcon: { fontSize: "22px" },
  qLabel: { fontSize: "13px", fontWeight: "600", color: "#5A3D28", fontFamily: "'DM Sans','Gill Sans',sans-serif" },
  chips: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", maxWidth: "480px" },
  chip: { background: "transparent", border: "1px solid rgba(196,151,58,0.25)", borderRadius: "50px", padding: "7px 14px", fontSize: "12px", color: "#A89070", cursor: "pointer", transition: "all 0.2s", fontFamily: "'DM Sans','Gill Sans',sans-serif", whiteSpace: "nowrap" },
  msgList: { flex: 1, overflowY: "auto", padding: "24px 22px", display: "flex", flexDirection: "column", gap: "18px", scrollbarWidth: "thin", scrollbarColor: "rgba(196,151,58,0.2) transparent" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: "10px" },
  botAvatar: { width: "32px", height: "32px", borderRadius: "11px", background: "linear-gradient(135deg,#8B5E3C,#C4973A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 10px rgba(196,151,58,0.3)" },
  userAvatar: { width: "32px", height: "32px", borderRadius: "11px", background: "linear-gradient(135deg,#3D2B1A,#7B5C3A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", color: "#FAF3E8", flexShrink: 0, fontFamily: "'DM Sans',sans-serif" },
  bubble: { maxWidth: "74%", padding: "13px 17px", borderRadius: "20px", lineHeight: 1.7, fontSize: "14.5px", position: "relative" },
  userBubble: { background: "linear-gradient(135deg,#6B4226,#C4973A)", color: "#FAF3E8", borderBottomRightRadius: "4px", boxShadow: "0 4px 20px rgba(107,66,38,0.25)" },
  botBubble: { background: "rgba(255,255,255,0.85)", color: "#3D2B1A", border: "1px solid rgba(196,151,58,0.12)", borderBottomLeftRadius: "4px", boxShadow: "0 2px 12px rgba(100,70,40,0.06)" },
  bubbleTxt: { whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "'DM Sans','Gill Sans',sans-serif", fontSize: "14px", lineHeight: 1.7 },
  ttsBtn: { background: "none", border: "none", cursor: "pointer", padding: "4px 0 0 6px", float: "right", transition: "color 0.2s", display: "inline-flex" },
  msgImage: { width: "100%", maxWidth: "260px", borderRadius: "12px", marginBottom: "8px", display: "block" },
  msgFile: { display: "flex", alignItems: "center", gap: "6px", background: "rgba(196,151,58,0.08)", borderRadius: "8px", padding: "6px 10px", marginBottom: "8px", fontSize: "12px", color: "#7B5C3A", fontFamily: "'DM Sans',sans-serif" },
  typingRow: { display: "flex", alignItems: "flex-end", gap: "10px", animation: "msgIn 0.3s ease both" },
  typingBubble: { background: "rgba(255,255,255,0.85)", border: "1px solid rgba(196,151,58,0.12)", borderRadius: "20px", borderBottomLeftRadius: "4px", padding: "16px 20px", display: "flex", gap: "5px", alignItems: "center", boxShadow: "0 2px 12px rgba(100,70,40,0.06)" },
  dot: { display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "rgba(196,151,58,0.7)", animation: "dotPulse 1.2s ease-in-out infinite" },
  errMsg: { color: "#B45309", fontSize: "13px", textAlign: "center", padding: "10px 18px", background: "rgba(180,83,9,0.06)", borderRadius: "12px", border: "1px solid rgba(180,83,9,0.15)", fontFamily: "'DM Sans',sans-serif" },
  inputArea: { borderTop: "1px solid rgba(196,151,58,0.1)", background: "rgba(255,255,255,0.5)" },
  filePreviews: { display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px 20px 0" },
  fileChip: { display: "flex", alignItems: "center", gap: "7px", background: "rgba(196,151,58,0.08)", border: "1px solid rgba(196,151,58,0.2)", borderRadius: "10px", padding: "6px 10px" },
  fileThumb: { width: "30px", height: "30px", objectFit: "cover", borderRadius: "6px" },
  fileName: { fontSize: "11px", color: "#7B5C3A", fontFamily: "'DM Sans',sans-serif", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileRemove: { background: "none", border: "none", cursor: "pointer", color: "#B08060", fontSize: "12px", padding: "0 0 0 4px" },
  suggRow: { display: "flex", gap: "8px", padding: "10px 20px 4px", overflowX: "auto", scrollbarWidth: "none" },
  chipSm: { background: "transparent", border: "1px solid rgba(196,151,58,0.2)", borderRadius: "50px", padding: "5px 12px", fontSize: "11px", color: "#A89070", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans',sans-serif", flexShrink: 0, transition: "all 0.2s" },
  bar: { display: "flex", alignItems: "center", gap: "8px", margin: "8px 16px", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(196,151,58,0.18)", borderRadius: "20px", padding: "10px 14px", boxShadow: "0 2px 16px rgba(100,70,40,0.07), inset 0 1px 0 rgba(255,255,255,0.9)" },
  barBtn: { background: "none", border: "none", color: "#B08060", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", transition: "color 0.2s", flexShrink: 0 },
  barBtnActive: { color: "#C4973A" },
  ta: { flex: 1, background: "none", border: "none", outline: "none", color: "#3D2B1A", fontSize: "14.5px", fontFamily: "'DM Sans','Gill Sans',sans-serif", resize: "none", lineHeight: 1.5, maxHeight: "110px", overflowY: "auto", scrollbarWidth: "none" },
  sendBtn: { width: "40px", height: "40px", flexShrink: 0, borderRadius: "14px", background: "rgba(196,151,58,0.08)", border: "1px solid rgba(196,151,58,0.15)", color: "rgba(196,151,58,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", transition: "all 0.22s" },
  sendBtnOn: { background: "linear-gradient(135deg,#8B5E3C,#C4973A)", border: "none", color: "#FAF3E8", cursor: "pointer", boxShadow: "0 4px 16px rgba(196,151,58,0.4)" },
  footNote: { textAlign: "center", fontSize: "10px", color: "rgba(160,130,100,0.5)", padding: "8px 0 14px", letterSpacing: "0.06em", fontFamily: "'DM Sans',sans-serif", textTransform: "uppercase" },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  textarea::placeholder{color:#C4A882;font-family:'DM Sans',sans-serif;}
  @keyframes msgIn{from{opacity:0;transform:translateY(12px) scale(0.97);}to{opacity:1;transform:none;}}
  @keyframes dotPulse{0%,100%{opacity:0.35;transform:scale(0.8);}50%{opacity:1;transform:scale(1.2);}}
  @keyframes blobDrift{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(40px,-50px) scale(1.06);}66%{transform:translate(-30px,30px) scale(0.96);}}
  @keyframes pulse2{0%,100%{box-shadow:0 8px 32px rgba(196,151,58,0.45);}50%{box-shadow:0 8px 48px rgba(196,151,58,0.7);}}
  @keyframes ringPop{0%{transform:scale(1);opacity:0.6;}100%{transform:scale(1.9);opacity:0;}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:none;}}
`;
