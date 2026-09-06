import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, ChevronRight, CircleDollarSign, FileText, Lightbulb, ListTodo, Menu, Mic, Plus, Send, Settings, Sparkles, Wallet, X } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { ChatMessage, Item, Section } from "./lib/types";

const nav: { id: Section; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "alvin", label: "Alvin", icon: Bot },
  { id: "finance", label: "Finance", icon: Wallet },
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "tasks", label: "Tasks", icon: ListTodo },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function titleFrom(text: string) {
  const clean = text.replace(/^\s*(catat|ingat|todo|ide)\s*[:,-]?\s*/i, "").trim();
  return clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
}

export default function App() {
  const [section, setSection] = useState<Section>("overview");
  const [items, setItems] = useState<Item[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Halo bro 👋 Gue Alvin. Tulis aja apa yang lagi lu pikirin. Semua masuk inbox dulu, lalu gue pahami konteksnya." }]);

  async function loadItems() {
    if (!supabase) return;
    const { data } = await supabase.from("items").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setItems(data as Item[]);
  }

  useEffect(() => {
    loadItems();
    supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function executeActions(userId: string, itemId: string, actions: any[]) {
    if (!supabase || !actions?.length) return;
    const created: string[] = [];
    for (const action of actions) {
      const type = String(action?.type ?? "");
      const title = titleFrom(String(action?.title ?? "")) || "Tanpa judul";
      const description = String(action?.description ?? "");
      if (type === "note") {
        const { data } = await supabase.from("notes").insert({ user_id: userId, title, content: description || title }).select("id").single();
        if (data?.id) created.push(`note:${data.id}`);
      } else if (type === "idea") {
        const { data } = await supabase.from("ideas").insert({ user_id: userId, title, description: description || title }).select("id").single();
        if (data?.id) created.push(`idea:${data.id}`);
      } else if (type === "task") {
        const due = action?.due_at ? String(action.due_at) : null;
        const priority = ["low", "medium", "high"].includes(String(action?.priority)) ? String(action.priority) : "medium";
        const { data } = await supabase.from("tasks").insert({ user_id: userId, title, description: description || title, due_at: due, priority }).select("id").single();
        if (data?.id) created.push(`task:${data.id}`);
      } else if (type === "finance") {
        const amount = Number(action?.amount);
        const txType = action?.transaction_type === "income" ? "income" : action?.transaction_type === "expense" ? "expense" : null;
        if (Number.isFinite(amount) && amount > 0 && txType) {
          const { data } = await supabase.from("transactions").insert({ user_id: userId, account_id: null, type: txType, amount, category: String(action?.category || "other"), description: description || title }).select("id").single();
          if (data?.id) created.push(`finance:${data.id}`);
        }
      }
    }
    await supabase.from("items").update({
      item_type: actions[0]?.type === "finance" ? "finance" : String(actions[0]?.type || "inbox"),
      status: created.length ? "processed" : "pending",
      ai_confidence: null,
      ai_reason: null,
      metadata: { actions, created },
      processed_at: created.length ? new Date().toISOString() : null
    }).eq("id", itemId).eq("user_id", userId);
    await loadItems();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: text }]);
    setSending(true);
    let itemId: string | null = null;
    const userId = supabase ? (await supabase.auth.getUser()).data.user?.id ?? null : null;

    if (supabase && userId) {
      const { data } = await supabase.from("items").insert({ user_id: userId, content: text, item_type: "inbox", status: "pending", source: "chat" }).select("id").single();
      itemId = data?.id ?? null;
      await loadItems();
    }

    try {
      const r = await fetch("/api/alvin-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      if (!r.ok) throw new Error("API unavailable");
      const data = await r.json();
      if (userId && itemId && Array.isArray(data.actions) && data.actions.length) await executeActions(userId, itemId, data.actions);
      else if (supabase && userId && itemId) await supabase.from("items").update({ item_type: data.classification || "inbox", ai_confidence: Number(data.confidence ?? 0), ai_reason: String(data.reason ?? ""), metadata: { actions: data.actions || [] } }).eq("id", itemId).eq("user_id", userId);
      setMessages(m => [...m, { role: "assistant", content: data.reply ?? "Oke, gue proses." }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: classify(text) }]);
    } finally {
      setSending(false);
    }
  }

  function classify(text: string) {
    const t = text.toLowerCase();
    if (/(rb|ribu|rp|rupiah|bayar|beli|belanja|harga|duit|uang)/.test(t)) return "Masuk inbox dulu. Ini kelihatannya Finance, tapi AI belum bisa memproses otomatis sekarang.";
    if (/(besok|nanti|harus|deadline|kerjain|kerjakan|ingatkan|jangan lupa)/.test(t)) return "Masuk inbox dulu. Ini kelihatannya Task, tapi AI belum bisa memproses otomatis sekarang.";
    if (/(kepikiran|ide|gimana kalau|kayaknya bisa|rencana bisnis)/.test(t)) return "Masuk inbox dulu. Ini kelihatannya Idea, tapi AI belum bisa memproses otomatis sekarang.";
    return "Sudah gue masukin ke inbox. Alvin akan memahami konteksnya dulu sebelum menentukan kategori.";
  }

  async function logout() { await supabase?.auth.signOut(); setEmail(null); }
  const counts = useMemo(() => ({ all: items.length, pending: items.filter(x => x.status === "pending").length, tasks: items.filter(x => x.item_type === "task").length, notes: items.filter(x => x.item_type === "note").length, ideas: items.filter(x => x.item_type === "idea").length, finance: items.filter(x => x.item_type === "finance").length }), [items]);

  const collectionType = section === "finance" ? "finance" : section === "ideas" ? "idea" : section === "notes" ? "note" : section === "tasks" ? "task" : "";
  const content = section === "overview" ? <Overview counts={counts} items={items} go={setSection} /> : section === "alvin" ? <Chat messages={messages} input={input} setInput={setInput} send={sendMessage} sending={sending} /> : section === "settings" ? <SettingsPanel email={email} logout={logout} /> : <Collection title={section[0].toUpperCase() + section.slice(1)} items={items.filter(x => x.item_type === collectionType)} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Bot size={21}/></div><div><b>Alvin</b><span>AI Assistant</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>{nav.map(n => { const I = n.icon; return <button key={n.id} className={section === n.id ? "active" : ""} onClick={() => { setSection(n.id); setMobileOpen(false); }}><I size={18}/><span>{n.label}</span></button>; })}</nav>
      <div className="sidebar-bottom"><button className={section === "settings" ? "active" : ""} onClick={() => setSection("settings")}><Settings size={18}/><span>Settings</span></button><small>{email || "Local demo mode"}</small></div>
    </aside>
    {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}
    <main className="main"><header className="topbar"><button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20}/></button><div><div className="eyebrow">PERSONAL COMMAND CENTER</div><h1>{section === "alvin" ? "Talk to Alvin" : section === "overview" ? "Good to see you." : section[0].toUpperCase() + section.slice(1)}</h1></div><div className="avatar"><Bot size={19}/></div></header><div className="page">{content}</div></main>
  </div>;
}

function Overview({ counts, items, go }: { counts: any; items: Item[]; go: (s: Section) => void }) {
  return <div className="stack"><section className="hero-card"><div><div className="pill"><Sparkles size={14}/> Context-aware inbox</div><h2>Tuangin aja isi kepala lu.</h2><p>Semua input masuk dulu sebagai item mentah. Alvin memahami konteks lalu memilahnya ke Task, Note, Idea, atau Finance.</p><button className="primary" onClick={() => go("alvin")}>Mulai ngobrol <ChevronRight size={17}/></button></div><div className="hero-orb"><Bot size={70}/></div></section><div className="stat-grid"><Stat label="Inbox" value={counts.all} icon={Sparkles}/><Stat label="Pending" value={counts.pending} icon={CheckCircle2}/><Stat label="Tasks" value={counts.tasks} icon={ListTodo}/><Stat label="Finance" value={counts.finance} icon={CircleDollarSign}/></div><section className="panel"><div className="panel-head"><div><h3>Recent items</h3><p>Input mentah tetap tersimpan sebagai konteks.</p></div><button className="ghost" onClick={() => go("alvin")}><Plus size={16}/> Add</button></div>{items.length ? <div className="items">{items.slice(0,8).map(i => <ItemRow key={i.id} item={i}/>)}</div> : <Empty/>}</section></div>;
}
function Stat({ label, value, icon: I }: any) { return <div className="stat"><div className="stat-icon"><I size={18}/></div><div><b>{value}</b><span>{label}</span></div></div>; }
function ItemRow({ item }: { item: Item }) { return <div className="item-row"><div className={`type-dot ${item.item_type}`}/><div className="item-main"><b>{item.content}</b><span>{formatDate(item.created_at)} · {item.item_type}</span></div><span className={`badge ${item.status}`}>{item.status}</span></div>; }
function Collection({ title, items }: { title: string; items: Item[] }) { return <section className="panel"><div className="panel-head"><div><h3>{title}</h3><p>Data hasil pemilahan konteks Alvin.</p></div></div>{items.length ? <div className="items">{items.map(i => <ItemRow key={i.id} item={i}/>)}</div> : <Empty/>}</section>; }
function Empty() { return <div className="empty"><Sparkles size={25}/><b>Belum ada data</b><span>Ngobrol dengan Alvin untuk mulai mengisi workspace.</span></div>; }

function Chat({ messages, input, setInput, send, sending }: any) {
  const [listening, setListening] = useState(false);
  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return alert("Browser ini belum mendukung voice input.");
    const r = new SR(); r.lang = "id-ID"; r.interimResults = false;
    r.onstart = () => setListening(true); r.onend = () => setListening(false); r.onerror = () => setListening(false);
    r.onresult = (e: any) => setInput((v: string) => `${v}${v ? " " : ""}${e.results[0][0].transcript}`); r.start();
  }
  return <div className="chat-layout"><section className="chat-card"><div className="chat-head"><div className="alvin-avatar"><Bot size={20}/></div><div><b>Alvin</b><span>Context-aware assistant</span></div><span className="online"/></div><div className="messages">{messages.map((m: ChatMessage, i: number) => <div key={i} className={`message ${m.role}`}><div>{m.content}</div></div>)}{sending && <div className="message assistant"><div className="typing"><i/><i/><i/></div></div>}</div><div className="composer"><button className={`icon-btn ${listening ? "recording" : ""}`} onClick={voice}><Mic size={17}/></button><textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Tulis apa aja..."/><button className="send" disabled={sending || !input.trim()} onClick={send}><Send size={17}/></button></div><div className="composer-hint">Enter untuk kirim · Shift+Enter untuk baris baru · mic untuk voice</div></section><aside className="chat-side"><div className="mini-card"><Sparkles size={18}/><b>Inbox-first</b><p>Input masuk ke items sebelum Alvin menentukan konteks.</p></div><div className="mini-card"><Bot size={18}/><b>Context aware</b><p>Satu kalimat bisa menghasilkan lebih dari satu maksud.</p></div></aside></div>;
}
function SettingsPanel({ email, logout }: { email: string | null; logout: () => void }) { return <section className="panel settings-grid"><div className="panel-head"><div><h3>Settings</h3><p>Pengaturan dasar Alvin.</p></div></div><div className="setting-row"><div><b>Account</b><span>{email || "Local demo mode"}</span></div></div><div className="setting-row"><div><b>Chat wallpaper</b><span>Light theme · soft blue & white</span></div></div><div className="setting-row"><div><b>Session</b><span>Keluar dari akun saat ini.</span></div><button className="ghost danger" onClick={logout}><X size={15}/> Sign out</button></div></section>; }
