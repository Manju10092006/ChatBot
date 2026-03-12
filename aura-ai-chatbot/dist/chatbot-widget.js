/**
 * Aura AI Chatbot – Embeddable Widget (no React dependency)
 * Features: voice input, TTS, file upload, image preview,
 *           drag-and-drop, suggestions, conversation history, new-chat reset.
 *
 * Usage:
 *   <script src="chatbot-widget.js"></script>
 *   <script>
 *     AuraChatbot.init({
 *       apiUrl: "https://api.myserver.com/chat",
 *       geminiApiKey: "YOUR_GEMINI_API_KEY",  // each site must supply its own key
 *       botName: "Aura"
 *     });
 *   </script>
 *
 * The geminiApiKey is forwarded to the backend with every request so the
 * server never needs a hard-coded or environment-variable API key.
 */
(function () {
  "use strict";

  if (window.__aura_loaded) return;
  window.__aura_loaded = true;

  // ── Tiny DOM helper ───────────────────────────────────────────────────────
  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    }
    return e;
  }

  // ── Suggestions shown on welcome screen ──────────────────────────────────
  var SUGGESTIONS = [
    "What is quantum entanglement?",
    "Write me a Python web scraper",
    "Give me a morning routine",
    "Explain neural networks",
  ];

  var QUICK_ACTIONS = [
    { icon: "⚡", label: "Code Helper",      prompt: "Help me write better, cleaner code with best practices" },
    { icon: "🎨", label: "Create & Design",  prompt: "Help me brainstorm a creative design concept" },
    { icon: "📖", label: "Explain Anything", prompt: "Explain a complex topic in simple, beautiful language" },
    { icon: "✦",  label: "Surprise Me",      prompt: "Share something fascinating I probably don't know" },
  ];

  // ── Main init ─────────────────────────────────────────────────────────────
  window.AuraChatbot = {
    init: function (opts) {
      var API_URL       = (opts && opts.apiUrl)       || "https://chatbot-030u.onrender.com/chat";
      var BOT_NAME      = (opts && opts.botName)      || "Aura";
      // API key provided by the embedding site — forwarded to the backend proxy.
      var GEMINI_API_KEY = (opts && opts.geminiApiKey) || null;

      var messages   = [];
      var isOpen     = false;
      var isListening = false;
      var pendingFile = null;   // { name, dataUrl, isImage }
      var recog      = null;
      var synth      = window.speechSynthesis || null;

      // ── CSS ───────────────────────────────────────────────────────────────
      var style = document.createElement("style");
      style.textContent = [
        "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');",
        "#aw-fab{position:fixed;bottom:24px;right:24px;width:60px;height:60px;border-radius:20px;background:linear-gradient(135deg,#8B5E3C,#C4973A);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(196,151,58,.45);z-index:99999;transition:transform .25s}",
        "#aw-fab:hover{transform:scale(1.08)}",
        "#aw-panel{position:fixed;bottom:96px;right:24px;width:420px;max-width:calc(100vw - 48px);height:640px;max-height:calc(100vh - 120px);background:#FAF7F1;border:1px solid rgba(196,151,58,.18);border-radius:24px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(100,70,40,.16);z-index:99998;font-family:'DM Sans',sans-serif}",
        "#aw-panel.open{display:flex}",
        "#aw-panel.drag-over{border:2px dashed rgba(196,151,58,.6)!important}",
        ".aw-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(196,151,58,.12);background:rgba(255,255,255,.5);gap:8px}",
        ".aw-hdr-title{font-size:15px;font-weight:600;color:#3D2B1A;flex:1}",
        ".aw-hdr-btn{background:rgba(196,151,58,.08);border:1px solid rgba(196,151,58,.2);border-radius:10px;color:#A89070;width:34px;height:34px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:all .2s}",
        ".aw-hdr-btn:hover,.aw-hdr-btn.on{background:rgba(196,151,58,.2);color:#C4973A}",
        /* welcome */
        ".aw-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;gap:16px;overflow-y:auto}",
        ".aw-welcome h2{font-size:22px;font-weight:700;color:#2C1A0E;text-align:center;font-family:'DM Sans',sans-serif}",
        ".aw-welcome p{font-size:13px;color:#8A7060;text-align:center;line-height:1.6}",
        ".aw-qa-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}",
        ".aw-qa{background:rgba(255,255,255,.75);border:1px solid rgba(196,151,58,.15);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;cursor:pointer;transition:transform .2s;text-align:left}",
        ".aw-qa:hover{transform:translateY(-3px)}",
        ".aw-qa-icon{font-size:18px}",
        ".aw-qa-label{font-size:12px;font-weight:600;color:#5A3D28}",
        ".aw-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}",
        ".aw-chip{background:transparent;border:1px solid rgba(196,151,58,.25);border-radius:50px;padding:5px 12px;font-size:11px;color:#A89070;cursor:pointer;transition:all .2s;font-family:'DM Sans',sans-serif}",
        ".aw-chip:hover{background:#E8DDD0;color:#4A3728}",
        /* messages */
        ".aw-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px}",
        ".aw-msg{display:flex;gap:8px;align-items:flex-end}",
        ".aw-msg.user{flex-direction:row-reverse}",
        ".aw-avatar{width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,#8B5E3C,#C4973A);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:#FAF3E8}",
        ".aw-msg.user .aw-avatar{background:linear-gradient(135deg,#3D2B1A,#7B5C3A)}",
        ".aw-bubble{max-width:78%;padding:10px 14px;border-radius:16px;font-size:13.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;position:relative}",
        ".aw-bubble.bot{background:#fff;border:1px solid rgba(196,151,58,.12);color:#3D2B1A;border-bottom-left-radius:4px}",
        ".aw-bubble.user{background:linear-gradient(135deg,#6B4226,#C4973A);color:#FAF3E8;border-bottom-right-radius:4px}",
        ".aw-bubble img{max-width:200px;border-radius:8px;display:block;margin-bottom:6px}",
        ".aw-bubble .aw-file-chip{display:flex;align-items:center;gap:5px;background:rgba(196,151,58,.1);border-radius:6px;padding:4px 8px;margin-bottom:6px;font-size:11px}",
        ".aw-tts-btn{background:none;border:none;cursor:pointer;color:#A89070;padding:2px 0 0 6px;float:right;font-size:11px;transition:color .2s}",
        ".aw-tts-btn:hover{color:#C4973A}",
        /* file preview bar */
        ".aw-file-bar{display:flex;gap:8px;flex-wrap:wrap;padding:8px 16px 0}",
        ".aw-fchip{display:flex;align-items:center;gap:6px;background:rgba(196,151,58,.08);border:1px solid rgba(196,151,58,.2);border-radius:9px;padding:5px 9px}",
        ".aw-fchip img{width:26px;height:26px;object-fit:cover;border-radius:5px}",
        ".aw-fchip span{font-size:11px;color:#7B5C3A;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".aw-fchip button{background:none;border:none;cursor:pointer;color:#B08060;font-size:11px;padding:0 0 0 3px}",
        /* suggestions under input */
        ".aw-sugg-row{display:flex;gap:6px;padding:6px 16px 0;overflow-x:auto;scrollbar-width:none}",
        ".aw-sugg-chip{background:transparent;border:1px solid rgba(196,151,58,.18);border-radius:50px;padding:4px 10px;font-size:11px;color:#A89070;cursor:pointer;white-space:nowrap;font-family:'DM Sans',sans-serif;flex-shrink:0;transition:all .2s}",
        ".aw-sugg-chip:hover{background:#E8DDD0;color:#4A3728}",
        /* input bar */
        ".aw-input-row{display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(196,151,58,.1);background:rgba(255,255,255,.5);align-items:center}",
        ".aw-ibar{display:flex;align-items:center;gap:6px;flex:1;background:rgba(255,255,255,.85);border:1px solid rgba(196,151,58,.18);border-radius:16px;padding:8px 12px}",
        ".aw-input{flex:1;border:none;outline:none;font-size:13.5px;font-family:'DM Sans',sans-serif;background:transparent;color:#3D2B1A;resize:none;line-height:1.4;max-height:90px;overflow-y:auto}",
        ".aw-input::placeholder{color:#C4A882}",
        ".aw-bar-btn{background:none;border:none;cursor:pointer;color:#B08060;display:flex;align-items:center;padding:2px;transition:color .2s;flex-shrink:0}",
        ".aw-bar-btn:hover,.aw-bar-btn.on{color:#C4973A}",
        ".aw-send{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#8B5E3C,#C4973A);border:none;color:#FAF3E8;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .2s}",
        ".aw-send:disabled{opacity:.35;cursor:not-allowed}",
        /* typing */
        ".aw-typing{display:none;gap:4px;align-items:center;padding:8px 12px;background:#fff;border:1px solid rgba(196,151,58,.12);border-radius:14px;border-bottom-left-radius:4px;width:fit-content;margin:0 0 0 36px}",
        ".aw-typing span{width:6px;height:6px;border-radius:50%;background:rgba(196,151,58,.6);animation:awDot 1.2s ease-in-out infinite;display:inline-block}",
        ".aw-typing span:nth-child(2){animation-delay:.18s}",
        ".aw-typing span:nth-child(3){animation-delay:.36s}",
        "@keyframes awDot{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}",
        ".aw-note{text-align:center;font-size:10px;color:rgba(160,130,100,.5);padding:6px 0 10px;letter-spacing:.05em;text-transform:uppercase}",
      ].join("");
      document.head.appendChild(style);

      // ── Build panel ───────────────────────────────────────────────────────
      var panel = document.createElement("div");
      panel.id = "aw-panel";

      // Header
      var hdrTitle = el("span", { "class": "aw-hdr-title" }, BOT_NAME + " ✦ AI");

      var newChatBtn = el("button", { "class": "aw-hdr-btn", title: "New chat" });
      newChatBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
      newChatBtn.addEventListener("click", resetChat);

      var ttsToggleBtn = el("button", { "class": "aw-hdr-btn on", title: "Toggle TTS" });
      ttsToggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
      var ttsEnabled = true;
      ttsToggleBtn.addEventListener("click", function () {
        ttsEnabled = !ttsEnabled;
        ttsToggleBtn.classList.toggle("on", ttsEnabled);
        if (!ttsEnabled && synth) synth.cancel();
      });

      var closeBtn = el("button", { "class": "aw-hdr-btn", title: "Close" });
      closeBtn.innerHTML = "✕";
      closeBtn.addEventListener("click", toggle);

      var hdr = el("div", { "class": "aw-hdr" }, hdrTitle, newChatBtn, ttsToggleBtn, closeBtn);

      // Welcome screen
      var welcome = document.createElement("div");
      welcome.className = "aw-welcome";
      welcome.innerHTML = "<h2>Hello, I\u2019m " + BOT_NAME + ".</h2><p>Your refined AI companion \u2014 ask anything, upload files, or speak freely.</p>";

      var qaGrid = el("div", { "class": "aw-qa-grid" });
      QUICK_ACTIONS.forEach(function (q) {
        var card = el("div", { "class": "aw-qa" },
          el("span", { "class": "aw-qa-icon" }, q.icon),
          el("span", { "class": "aw-qa-label" }, q.label)
        );
        card.addEventListener("click", function () { sendMessage(q.prompt); });
        qaGrid.appendChild(card);
      });

      var chipsWrap = el("div", { "class": "aw-chips" });
      SUGGESTIONS.forEach(function (s) {
        var chip = el("button", { "class": "aw-chip" }, s);
        chip.addEventListener("click", function () { sendMessage(s); });
        chipsWrap.appendChild(chip);
      });

      welcome.appendChild(qaGrid);
      welcome.appendChild(chipsWrap);

      // Body (messages)
      var body = el("div", { "class": "aw-body" });
      body.style.display = "none";

      // Typing indicator
      var typing = el("div", { "class": "aw-typing" }, el("span"), el("span"), el("span"));

      // File preview bar
      var fileBar = el("div", { "class": "aw-file-bar" });
      fileBar.style.display = "none";

      // Suggestions row (shown after first message)
      var suggRow = el("div", { "class": "aw-sugg-row" });
      suggRow.style.display = "none";
      SUGGESTIONS.slice(0, 3).forEach(function (s) {
        var chip = el("button", { "class": "aw-sugg-chip" }, s);
        chip.addEventListener("click", function () { sendMessage(s); });
        suggRow.appendChild(chip);
      });

      // Input
      var input = el("textarea", { "class": "aw-input", rows: "1", placeholder: "Message " + BOT_NAME + "\u2026" });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });

      // Mic button
      var micBtn = el("button", { "class": "aw-bar-btn", title: "Voice input" });
      micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
      micBtn.addEventListener("click", toggleMic);

      // Attach button
      var fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = false;
      fileInput.accept = "*/*";
      fileInput.style.display = "none";
      fileInput.addEventListener("change", function (e) { handleFile(e.target.files[0]); e.target.value = ""; });
      document.body.appendChild(fileInput);

      var attachBtn = el("button", { "class": "aw-bar-btn", title: "Attach file" });
      attachBtn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
      attachBtn.addEventListener("click", function () { fileInput.click(); });

      var ibar = el("div", { "class": "aw-ibar" }, attachBtn, input, micBtn);

      var sendBtn = el("button", { "class": "aw-send" });
      sendBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      sendBtn.addEventListener("click", function () { sendMessage(); });

      var inputRow = el("div", { "class": "aw-input-row" }, ibar, sendBtn);
      var note = el("div", { "class": "aw-note" }, BOT_NAME + " \u00B7 Powered by Gemini \u00B7 Your data stays private");

      panel.appendChild(hdr);
      panel.appendChild(welcome);
      panel.appendChild(body);
      panel.appendChild(typing);
      panel.appendChild(fileBar);
      panel.appendChild(suggRow);
      panel.appendChild(inputRow);
      panel.appendChild(note);
      document.body.appendChild(panel);

      // ── FAB ───────────────────────────────────────────────────────────────
      var fab = document.createElement("button");
      fab.id = "aw-fab";
      fab.title = "Open " + BOT_NAME;
      fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="#FAF3E8" opacity="0.9"/><path d="M19 16L19.9 18.1L22 19L19.9 19.9L19 22L18.1 19.9L16 19L18.1 18.1L19 16Z" fill="#FAF3E8" opacity="0.5"/></svg>';
      fab.addEventListener("click", toggle);
      document.body.appendChild(fab);

      // ── Drag-and-drop onto panel ──────────────────────────────────────────
      panel.addEventListener("dragover", function (e) { e.preventDefault(); panel.classList.add("drag-over"); });
      panel.addEventListener("dragleave", function () { panel.classList.remove("drag-over"); });
      panel.addEventListener("drop", function (e) {
        e.preventDefault();
        panel.classList.remove("drag-over");
        var f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      });

      // ── Voice input ───────────────────────────────────────────────────────
      function toggleMic() {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert("Voice input not supported in this browser."); return; }
        if (isListening) {
          if (recog) recog.stop();
          return;
        }
        recog = new SR();
        recog.lang = "en-US";
        recog.interimResults = true;
        recog.continuous = false;
        recog.onresult = function (e) {
          var t = Array.from(e.results).map(function (r) { return r[0].transcript; }).join("");
          input.value = t;
        };
        recog.onstart = function () {
          isListening = true;
          micBtn.classList.add("on");
          micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#C4973A" stroke="#C4973A" stroke-width="1"><rect x="9" y="4" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2" fill="none" stroke-width="2"/><line x1="12" y1="19" x2="12" y2="23" stroke-width="2"/></svg>';
        };
        recog.onend = recog.onerror = function () {
          isListening = false;
          micBtn.classList.remove("on");
          micBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
        };
        recog.start();
      }

      // ── TTS ───────────────────────────────────────────────────────────────
      function speak(text) {
        if (!ttsEnabled || !synth) return;
        synth.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 1; u.pitch = 1;
        var voices = synth.getVoices();
        var v = voices.find(function (x) { return x.name.includes("Google") && x.lang === "en-US"; }) || voices[0];
        if (v) u.voice = v;
        synth.speak(u);
      }

      // ── File handling ─────────────────────────────────────────────────────
      function handleFile(file) {
        if (!file) return;
        var isImg = file.type.startsWith("image/");
        var reader = new FileReader();
        reader.onload = function (e) {
          pendingFile = { name: file.name, dataUrl: isImg ? e.target.result : null, isImage: isImg };
          renderFileBar();
        };
        reader.readAsDataURL(file);
      }

      function renderFileBar() {
        fileBar.innerHTML = "";
        if (!pendingFile) { fileBar.style.display = "none"; return; }
        fileBar.style.display = "flex";
        var chip = el("div", { "class": "aw-fchip" });
        if (pendingFile.isImage && pendingFile.dataUrl) {
          var thumb = el("img", { src: pendingFile.dataUrl, alt: "" });
          chip.appendChild(thumb);
        } else {
          chip.appendChild(document.createTextNode("📄"));
        }
        var nameSpan = el("span", {}, pendingFile.name.length > 18 ? pendingFile.name.slice(0, 15) + "…" : pendingFile.name);
        var rmBtn = el("button", {}, "✕");
        rmBtn.addEventListener("click", function () { pendingFile = null; renderFileBar(); });
        chip.appendChild(nameSpan);
        chip.appendChild(rmBtn);
        fileBar.appendChild(chip);
      }

      // ── Add message bubble ────────────────────────────────────────────────
      function addMsg(role, text, imgUrl, fileName) {
        var isUser = role === "user";
        var row = el("div", { "class": "aw-msg" + (isUser ? " user" : "") });

        var starSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="#FAF3E8" opacity="0.9"/></svg>';
        var avatar = el("div", { "class": "aw-avatar" });
        avatar.innerHTML = isUser ? "U" : starSvg;

        var bubble = el("div", { "class": "aw-bubble " + (isUser ? "user" : "bot") });

        if (imgUrl) {
          var img = el("img", { src: imgUrl, alt: "upload" });
          bubble.appendChild(img);
        } else if (fileName) {
          var fc = el("div", { "class": "aw-file-chip" });
          fc.innerHTML = "📄 " + fileName;
          bubble.appendChild(fc);
        }

        bubble.appendChild(document.createTextNode(text));

        if (!isUser) {
          var ttsBtn = el("button", { "class": "aw-tts-btn", title: "Read aloud" });
          ttsBtn.innerHTML = "🔊";
          ttsBtn.addEventListener("click", function () { speak(text); });
          bubble.appendChild(ttsBtn);
        }

        row.appendChild(avatar);
        row.appendChild(bubble);
        body.appendChild(row);
        body.scrollTop = body.scrollHeight;
      }

      // ── Send message ──────────────────────────────────────────────────────
      async function sendMessage(overrideText) {
        var text = (overrideText || input.value).trim();
        if (!text && !pendingFile) return;

        var imgUrl   = pendingFile && pendingFile.isImage  ? pendingFile.dataUrl : null;
        var fileName = pendingFile && !pendingFile.isImage ? pendingFile.name    : null;
        var displayText = text || (fileName ? "[File: " + fileName + "]" : "[Image]");

        input.value = "";
        pendingFile  = null;
        renderFileBar();

        // Switch from welcome to message view
        if (welcome.style.display !== "none") {
          welcome.style.display = "none";
          body.style.display = "flex";
          suggRow.style.display = "flex";
        }

        messages.push({ role: "user", content: displayText });
        addMsg("user", displayText, imgUrl, fileName);

        sendBtn.disabled = true;
        typing.style.display = "flex";
        body.scrollTop = body.scrollHeight;

        try {
          var apiMsgs = messages.map(function (m) { return { role: m.role, content: m.content }; });
          // Include the user's Gemini API key so the backend can proxy the request.
          var res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: apiMsgs, apiKey: GEMINI_API_KEY }),
          });
          if (!res.ok) throw new Error("Server error " + res.status);
          var data = await res.json();
          var reply = data.reply || "No response.";
          messages.push({ role: "assistant", content: reply });
          addMsg("assistant", reply);
          speak(reply);
        } catch (err) {
          addMsg("assistant", "Sorry, something went wrong. Please try again.");
        } finally {
          typing.style.display = "none";
          sendBtn.disabled = false;
          input.focus();
        }
      }

      // ── Reset / new chat ──────────────────────────────────────────────────
      function resetChat() {
        messages = [];
        pendingFile = null;
        renderFileBar();
        body.innerHTML = "";
        body.style.display = "none";
        typing.style.display = "none";
        suggRow.style.display = "none";
        welcome.style.display = "flex";
        if (synth) synth.cancel();
      }

      // ── Toggle panel ──────────────────────────────────────────────────────
      function toggle() {
        isOpen = !isOpen;
        panel.classList.toggle("open", isOpen);
        if (isOpen) setTimeout(function () { input.focus(); }, 150);
      }
    },
  };
})();
