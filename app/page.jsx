'use client';

import { useEffect, useRef, useState } from "react";
import { Send, Link2, ShieldAlert, Loader2, Mail, MessageSquare, Camera, Upload } from "lucide-react";

export default function Page() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "🛡️ Hello! I'm Garuda, your AI-powered phishing detection assistant. I can help you identify suspicious URLs, emails, messages, and screenshots. What would you like me to check for you?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Phishing detection states
  const [detectionType, setDetectionType] = useState('url');
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, checkResult]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].slice(-12) })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, citations: data.citations || [] }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error: could not fetch response from model.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function checkPhishing() {
    let inputData = {};
    let hasInput = false;

    switch (detectionType) {
      case 'url':
        if (!url.trim()) return;
        inputData = { url: url.trim() };
        hasInput = true;
        break;
      case 'email':
        if (!email.trim()) return;
        inputData = { email: email.trim() };
        hasInput = true;
        break;
      case 'message':
        if (!message.trim()) return;
        inputData = { message: message.trim() };
        hasInput = true;
        break;
      case 'screenshot':
        if (!screenshot) return;
        inputData = { screenshot: screenshot };
        hasInput = true;
        break;
    }

    if (!hasInput) return;

    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/phishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputData)
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (e) {
      setCheckResult({ label: 'Error', confidence: 0, details: ['Could not check'] });
    } finally {
      setChecking(false);
    }
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setScreenshot(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function clearInputs() {
    setUrl("");
    setEmail("");
    setMessage("");
    setScreenshot(null);
    setCheckResult(null);
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-10 gap-6">
      {/* Chatbot Area - 70% (7/10) */}
      <div className="col-span-7 card">
        <h1 className="text-2xl font-semibold">🛡️ Garuda - Phishing Detection Assistant</h1>
        <p className="text-slate-400 mt-1">AI-powered assistant for detecting phishing attempts in URLs, emails, messages, and screenshots.</p>

        <div className="mt-4 h-[65vh] overflow-y-auto space-y-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={m.role === 'user' ? 'message-user' : 'message-bot'}>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                {m.citations?.length ? (
                  <div className="mt-2 text-xs text-slate-300">
                    <div className="font-semibold">Sources:</div>
                    <ul className="list-disc pl-5">
                      {m.citations.map((c,idx) => (
                        <li key={idx}>
                          <a target="_blank" href={c.url} className="underline">{c.title}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="message-bot animation-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <input
            className="input"
            placeholder="Ask about banking terms, loans, or fraud safety..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          />
          <button
            className="btn inline-flex items-center gap-2"
            onClick={sendMessage}
            disabled={loading}
          >
            <Send className="w-4 h-4" /> Ask
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          We don’t store chats. Always verify financial decisions with official sources.
        </p>
      </div>

      {/* Phishing Checker - 30% (3/10) */}
      <div className="col-span-3 card">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Phishing Detector
        </h2>
        <p className="text-slate-400 mt-1">Detect phishing in URLs, emails, messages, and screenshots.</p>

        <div className="mt-4 space-y-3">
          {/* Detection Type Selector */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
            {[
              { id: 'url', label: 'URL', icon: Link2 },
              { id: 'email', label: 'Email', icon: Mail },
              { id: 'message', label: 'Message', icon: MessageSquare },
              { id: 'screenshot', label: 'Screenshot', icon: Camera }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setDetectionType(id); clearInputs(); }}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs ${
                  detectionType === id ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Input Fields */}
          <div className="space-y-2">
            {detectionType === 'url' && (
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="https://example.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') checkPhishing(); }}
                />
                <button className="btn" onClick={checkPhishing} disabled={checking}>
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                </button>
              </div>
            )}

            {detectionType === 'email' && (
              <div className="flex gap-2">
                <textarea
                  className="input min-h-[100px] resize-none"
                  placeholder="Paste email content here..."
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <button className="btn" onClick={checkPhishing} disabled={checking}>
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                </button>
              </div>
            )}

            {detectionType === 'message' && (
              <div className="flex gap-2">
                <textarea
                  className="input min-h-[100px] resize-none"
                  placeholder="Paste message content here..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                <button className="btn" onClick={checkPhishing} disabled={checking}>
                  {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                </button>
              </div>
            )}

            {detectionType === 'screenshot' && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  className="input"
                />
                {screenshot && (
                  <div className="relative">
                    <img src={screenshot} alt="Screenshot preview" className="w-full h-32 object-cover rounded-lg" />
                    <button
                      className="btn mt-2 w-full"
                      onClick={checkPhishing}
                      disabled={checking}
                    >
                      {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      Analyze Screenshot
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Results */}
          {checkResult && (
            <div className="rounded-lg border border-slate-700 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{checkResult.label}</div>
                <div className="text-xs text-slate-300">
                  Confidence: {Math.round((checkResult.confidence || 0) * 100)}%
                </div>
              </div>
              <div className="text-xs mt-2 text-slate-300">{checkResult.summary}</div>
              <ul className="text-xs mt-2 list-disc pl-5 text-slate-300">
                {checkResult.details?.map((d, idx) => <li key={idx}>{d}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
