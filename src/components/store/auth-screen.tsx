import { useEffect, useState, type FormEvent } from "react";
import { Store, ShieldCheck } from "lucide-react";
import { api, errMsg, setToken } from "@/lib/api";
import { inputCls, type UserDto } from "./ui";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";

// Quick-fill buttons for the seeded demo logins: development builds only, unless a deployment
// deliberately opts in (VITE_SHOW_DEMO_ACCOUNTS=true) for a presentation.
const showDemoAccounts =
  import.meta.env.DEV || import.meta.env["VITE_SHOW_DEMO_ACCOUNTS"] === "true";

/** Login, registration, email verification and password reset in one screen. */
export function AuthScreen({ onAuthed }: { onAuthed: (u: UserDto) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devToken, setDevToken] = useState<{ kind: "verify" | "reset"; token: string } | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "student", businessReg: "", token: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  // Links from the verification / reset emails look like /?verify=TOKEN and /?reset=TOKEN
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("verify");
    const r = q.get("reset");
    if (v) {
      setMode("verify");
      setBusy(true);
      api<{ message: string }>("auth/verify-email", { body: { token: v } })
        .then((d) => setInfo(d.message))
        .catch((e) => setError(errMsg(e)))
        .finally(() => {
          setBusy(false);
          window.history.replaceState(null, "", "/");
        });
    } else if (r) {
      setMode("reset");
      setF((p) => ({ ...p, token: r }));
      window.history.replaceState(null, "", "/");
    }
  }, []);

  const go = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
    setDevToken(null);
    setNeedsVerify(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "login") {
        const d = await api<{ token: string; user: UserDto }>("auth/login", {
          body: { email: f.email, password: f.password },
        });
        setToken(d.token);
        onAuthed(d.user);
      } else if (mode === "register") {
        const d = await api<{ message: string; devVerifyToken?: string }>("auth/register", {
          body: { name: f.name, email: f.email, password: f.password, role: f.role, businessReg: f.businessReg },
        });
        setInfo(d.message);
        if (d.devVerifyToken) setDevToken({ kind: "verify", token: d.devVerifyToken });
      } else if (mode === "forgot") {
        const d = await api<{ message: string; devResetToken?: string }>("auth/forgot", { body: { email: f.email } });
        setInfo(d.message);
        if (d.devResetToken) setDevToken({ kind: "reset", token: d.devResetToken });
      } else if (mode === "reset") {
        const d = await api<{ message: string }>("auth/reset", { body: { token: f.token, password: f.password } });
        go("login");
        setInfo(d.message);
      }
    } catch (err) {
      setError(errMsg(err));
      if (mode === "login" && (err as { data?: { needsVerification?: boolean } }).data?.needsVerification) {
        setNeedsVerify(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const d = await api<{ message: string; devVerifyToken?: string }>("auth/resend-verification", { body: { email: f.email } });
      setInfo(d.message);
      setError("");
      if (d.devVerifyToken) setDevToken({ kind: "verify", token: d.devVerifyToken });
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const useDevToken = async () => {
    if (!devToken) return;
    if (devToken.kind === "verify") {
      setBusy(true);
      try {
        const d = await api<{ message: string }>("auth/verify-email", { body: { token: devToken.token } });
        go("login");
        setInfo(d.message);
      } catch (err) {
        setError(errMsg(err));
      } finally {
        setBusy(false);
      }
    } else {
      setF({ ...f, token: devToken.token, password: "" });
      setMode("reset");
      setDevToken(null);
      setInfo("");
    }
  };

  const title = { login: "Welcome back", register: "Create your account", forgot: "Reset your password", reset: "Choose a new password", verify: "Email verification" }[mode];

  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </span>
          <span className="text-xl font-extrabold">
            Community<span className="text-primary"> Store</span>
          </span>
        </div>
        <h1 className="text-lg font-bold">{title}</h1>

        {mode !== "verify" && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {(["student", "vendor", "resident"] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setF({ ...f, role: r })}
                      className={`rounded-xl border px-2 py-2 font-medium capitalize ${f.role === r ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input required minLength={2} maxLength={60} value={f.name} onChange={set("name")} placeholder={f.role === "vendor" ? "Business name" : "Full name"} className={inputCls} />
              </>
            )}
            {mode !== "reset" && (
              <input
                required
                type="email"
                value={f.email}
                onChange={set("email")}
                placeholder={f.role === "student" && mode === "register" ? "you@mycput.ac.za" : "Email address"}
                autoComplete="email"
                className={inputCls}
              />
            )}
            {mode === "register" && f.role === "vendor" && (
              <input required value={f.businessReg} onChange={set("businessReg")} placeholder="Business registration no. (e.g. 2020/123456/07)" className={inputCls} />
            )}
            {mode === "reset" && (
              <input required value={f.token} onChange={set("token")} placeholder="Reset code from your email" className={inputCls} />
            )}
            {mode !== "forgot" && (
              <input
                required
                type="password"
                minLength={mode === "login" ? 1 : 8}
                value={f.password}
                onChange={set("password")}
                placeholder={mode === "login" ? "Password" : "Password (8+ characters, letters and numbers)"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={inputCls}
              />
            )}
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            {info && <p className="rounded-lg bg-primary-soft p-2 text-sm text-primary">{info}</p>}
            {devToken && (
              <div className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
                <p>
                  <b>Development mode:</b> no email provider is connected, so the link is shown here (and written to <code>data/outbox.log</code>).
                </p>
                <button type="button" onClick={useDevToken} className="mt-1 font-semibold text-primary underline">
                  {devToken.kind === "verify" ? "Verify my email now" : "Continue to reset password"}
                </button>
              </div>
            )}
            {needsVerify && (
              <button type="button" onClick={resend} className="text-sm font-semibold text-primary underline">
                Send a new verification link
              </button>
            )}
            <button disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Please wait…" : { login: "Log in", register: "Create account", forgot: "Send reset link", reset: "Update password", verify: "" }[mode]}
            </button>
          </form>
        )}

        {mode === "verify" && (
          <div className="mt-4 space-y-3">
            {busy && <p className="text-sm text-muted-foreground">Verifying…</p>}
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
            {info && <p className="rounded-lg bg-primary-soft p-2 text-sm text-primary">{info}</p>}
            <button onClick={() => go("login")} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
              Go to log in
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          {mode === "login" ? (
            <>
              <button onClick={() => go("register")} className="font-semibold text-primary">Create an account</button>
              <button onClick={() => go("forgot")} className="text-muted-foreground hover:underline">Forgot password?</button>
            </>
          ) : (
            mode !== "verify" && <button onClick={() => go("login")} className="font-semibold text-primary">← Back to log in</button>
          )}
        </div>

        {mode === "login" && showDemoAccounts && (
          <div className="mt-5 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> 
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ["Student", "lesego@mycput.ac.za"],
                ["Vendor", "thandi@kitchen.co.za"],
                ["Faculty", "zanele@cput.ac.za"],
                ["Resident", "pieter@gmail.com"],
              ].map(([label, email]) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => setF({ ...f, email: email ?? "", password: "Demo@1234" })}
                  className="rounded-full border bg-card px-3 py-1 font-medium text-foreground hover:border-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
