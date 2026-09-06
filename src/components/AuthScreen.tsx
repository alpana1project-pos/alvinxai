import { FormEvent, useState } from "react";
import { Bot, Eye, EyeOff, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setNotice("Link reset password sudah dikirim ke email lu.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice(data.session ? "Akun berhasil dibuat." : "Akun dibuat. Cek email lu untuk konfirmasi.");
        if (data.session) window.location.reload();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.reload();
      }
    } catch (err: any) { setError(err?.message || "Autentikasi gagal."); }
    finally { setBusy(false); }
  }

  if (!supabase) return <div className="auth-page"><div className="auth-card"><Bot size={30}/><h1>Alvin belum terhubung</h1><p>VITE_SUPABASE_URL dan publishable key belum tersedia.</p></div></div>;
  const title = mode === "login" ? "Masuk ke Alvin" : mode === "signup" ? "Buat akun Alvin" : "Reset password";
  return <div className="auth-page">
    <div className="auth-glow" />
    <div className="auth-card">
      <div className="auth-brand"><div className="brand-mark"><Bot size={22}/></div><div><b>Alvin</b><span>AI Assistant</span></div></div>
      <div className="auth-badge"><Sparkles size={13}/> Personal command center</div>
      <h1>{title}</h1>
      <p className="auth-sub">Satu tempat buat ngobrol, nyatet, ngatur task, ide, dan finance.</p>
      <form onSubmit={submit}>
        <label>Email<div className="field"><Mail size={16}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" required /></div></label>
        {mode !== "reset" && <label>Password<div className="field"><LockKeyhole size={16}/><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 6 karakter" minLength={6} required /><button type="button" className="field-eye" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>}
        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-notice">{notice}</div>}
        <button className="auth-submit" disabled={busy}>{busy ? <Loader2 size={17} className="spin"/> : null}{busy ? "Memproses..." : mode === "login" ? "Masuk" : mode === "signup" ? "Daftar" : "Kirim link reset"}</button>
      </form>
      <div className="auth-links">
        {mode === "login" && <><button onClick={() => setMode("signup")}>Belum punya akun? Daftar</button><button onClick={() => setMode("reset")}>Lupa password?</button></>}
        {mode === "signup" && <button onClick={() => setMode("login")}>Sudah punya akun? Masuk</button>}
        {mode === "reset" && <button onClick={() => setMode("login")}>Kembali ke login</button>}
      </div>
    </div>
  </div>;
}
