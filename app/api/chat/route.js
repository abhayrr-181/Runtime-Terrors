import { NextResponse } from "next/server";

const HF_API = process.env.HUGGINGFACE_API_KEY;
const LLAMA_MODEL = process.env.HF_CHAT_MODEL || 'meta-llama/Llama-2-7b-chat-hf';

async function callHfModel(prompt) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${LLAMA_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_API}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true, use_cache: false } })
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (typeof data === 'string') return data;
    if (data?.generated_text) return data.generated_text;
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    if (data?.error) throw new Error(data.error);
    return JSON.stringify(data);
  } else {
    return await res.text();
  }
}

function buildSystemPrompt() {
  return [
    "You are Secure FinBot — a friendly, concise financial assistant specialized in banking, loans, and fraud alerts.",
    "Answer clearly in simple language. Use short bullet lists when helpful. Do not give legal or financial advice; suggest official sources or a professional.",
    "When asked about scams or fraud, include at least one reputable source where the user can read more."
  ].join('\n');
}

function buildChatPrompt(messages) {
  const sys = buildSystemPrompt();
  const conv = ['System: ' + sys];
  for (const m of messages) {
    const role = m.role === 'user' ? 'User' : (m.role === 'assistant' ? 'Assistant' : m.role);
    conv.push(`${role}: ${m.content}`);
  }
  conv.push('Assistant:');
  return conv.join('\n');
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const prompt = buildChatPrompt(messages);
    const output = await callHfModel(prompt);

    // Basic keyword-based citations (Wikipedia + FTC)
    const lastUser = messages.slice().reverse().find(m => m.role === 'user')?.content || '';
    const kws = lastUser.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0,6);
    const citations = [];
    for (const k of kws) {
      try {
        if (k.includes('phishing') || k.includes('scam')) citations.push({ title: 'FTC: Recognizing and Avoiding Phishing Scams', url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' });
        const s = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(k)}&limit=1`);
        if (s.ok) {
          const d = await s.json();
          if (d?.pages?.length) {
            const p = d.pages[0];
            citations.push({ title: p.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/\s+/g,'_'))}` });
          }
        }
      } catch(e){}
    }
    // dedupe and cap
    const uniq = new Map();
    for (const c of citations) if (!uniq.has(c.url)) uniq.set(c.url, c);
    const final = Array.from(uniq.values()).slice(0,3);

    return NextResponse.json({ message: output, citations: final });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Error generating response.' }, { status: 500 });
  }
}
