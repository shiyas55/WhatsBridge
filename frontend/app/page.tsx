"use client";
import { useEffect, useState, useCallback, useRef, FormEvent } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Blocks,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Contact,
  Copy,
  Globe,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  Webhook,
  Workflow,
  Zap,
  Menu,
  Trash2,
  GripVertical,
  Play,
  Clock,
  GitBranch,
  X,
  QrCode,
  Smartphone,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

type Row = Record<string, any>;
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: string;
  required?: boolean;
};
const nav = [
  ["Workspace", ["Overview", "Projects", "Connections", "API Keys"]],
  [
    "Build",
    [
      "Send Message",
      "Inbox",
      "Contacts",
      "OTP Verification",
      "Workflow Builder",
      "Templates",
      "Webhooks",
    ],
  ],
  [
    "Manage",
    [
      "AI Assistant",
      "Analytics",
      "Usage & Billing",
      "Team Members",
      "Settings",
      "Admin",
    ],
  ],
  ["Resources", ["API Playground", "API Documentation"]],
] as const;
const icons: Record<string, any> = {
  Overview: LayoutDashboard,
  Projects: Blocks,
  Connections: MessageCircle,
  "API Keys": KeyRound,
  "Send Message": Send,
  Inbox: Mail,
  Contacts: Contact,
  "OTP Verification": ShieldCheck,
  "Workflow Builder": Workflow,
  Templates: BookOpen,
  Webhooks: Webhook,
  "AI Assistant": Sparkles,
  Analytics: Activity,
  "Usage & Billing": Globe,
  "Team Members": Users,
  Settings: Settings,
  "API Playground": Code2,
  "API Documentation": BookOpen,
  Admin: ShieldCheck,
};
const descriptions: Record<string, string> = {
  Overview: "Your messaging infrastructure, at a glance.",
  Projects: "Separate your environments, credentials, and integrations.",
  Connections: "Connect a supported transport to your application.",
  "API Keys": "Scoped access. Secrets shown once. Control that stays with you.",
  "Send Message":
    "Send a consent-based message through your project transport.",
  Inbox: "Follow incoming messages and confirmed delivery events.",
  Contacts: "Keep recipient details and a verifiable consent history.",
  "OTP Verification": "Test single-use verification in a safe sandbox.",
  "Workflow Builder":
    "Build an ordered automation. Publish a version when it is ready.",
  Webhooks: "Deliver signed events to your approved HTTPS endpoints.",
  Templates:
    "Save reusable template drafts. Manage provider approval in Meta WhatsApp Manager.",
  "AI Assistant": "Draft, classify, and summarize with human review.",
  Analytics: "Real activity from your project.",
  "Usage & Billing":
    "Track reservations and accepted sends against your organization limit.",
  "Team Members": "Invite collaborators with the right level of access.",
  Settings: "Manage your account and project settings.",
  Admin: "Platform-wide controls for authorized administrators.",
  "API Playground": "Try the API with your secure browser session.",
  "API Documentation": "Everything you need to connect your application.",
};
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className={"badge " + String(children).toLowerCase()}>
      {children}
    </span>
  );
}
function Form({
  fields,
  submit,
  label = "Save",
  children,
}: {
  fields: Field[];
  submit: (data: Row) => Promise<void>;
  label?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "100%",
        minHeight: "fit-content",
        flexShrink: 0,
      }}
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        setBusy(true);
        try {
          await submit(data);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <label
          className="field"
          key={f.name}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%",
            flexShrink: 0,
          }}
        >
          <span className="field-label" style={{ fontSize: "14px", fontWeight: 600, color: "#1F2937" }}>
            {f.label}
          </span>
          {f.options ? (
            <select
              name={f.name}
              defaultValue={f.value}
              required={f.required !== false}
              style={{
                width: "100%",
                height: "46px",
                padding: "0 16px",
                borderRadius: "10px",
                border: "1px solid #D1D5DB",
                background: "#ffffff",
                color: "#111827",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            >
              {f.options.map((o) => (
                <option value={o.value} key={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.name}
              defaultValue={f.value}
              required={f.required !== false}
              rows={4}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid #D1D5DB",
                background: "#ffffff",
                color: "#111827",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          ) : (
            <input
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={f.value}
              required={f.required !== false}
              style={{
                width: "100%",
                height: "46px",
                padding: "0 16px",
                borderRadius: "10px",
                border: "1px solid #D1D5DB",
                background: "#ffffff",
                color: "#111827",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
          )}
        </label>
      ))}
      {children}
      <button
        className="primary"
        disabled={busy}
        style={{
          alignSelf: "flex-start",
          width: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          marginTop: "6px",
          padding: "10px 22px",
          borderRadius: "8px",
          background: "#107548",
          color: "#ffffff",
          fontWeight: 600,
          fontSize: "14px",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {busy ? "Working…" : label}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function Empty({
  text = "No records yet. Create your first one to get started.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon-wrap">
        <MessageCircle size={24} />
      </div>
      <h3>No data available</h3>
      <p>{text}</p>
    </div>
  );
}
export default function Home() {
  const [user, setUser] = useState<Row | null>(null),
    [ready, setReady] = useState(false),
    [csrf, setCsrf] = useState(""),
    [page, setPage] = useState("Overview"),
    [projects, setProjects] = useState<Row[]>([]),
    [orgs, setOrgs] = useState<Row[]>([]),
    [project, setProject] = useState(""),
    [stats, setStats] = useState<Row>({}),
    [rows, setRows] = useState<Row[]>([]),
    [connections, setConnections] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [result, setResult] = useState<any>(null),
    [modal, setModal] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [authMode, setAuthMode] = useState("login"),
    [regStep, setRegStep] = useState<"details" | "verify">("details"),
    [regChannel, setRegChannel] = useState<"whatsapp" | "email">("whatsapp"),
    [regEmail, setRegEmail] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const active = projects.find((p) => p.id === project);
  const api = useCallback(
    async (path: string, method = "GET", body?: Row, extra: Row = {}) => {
      let activeCsrf = csrf;
      if (typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
        if (match && match[1]) {
          activeCsrf = decodeURIComponent(match[1]);
        }
      }
      const r = await fetch(path, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": (extra["X-CSRFToken"] as string) || activeCsrf || csrf,
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = r.status === 204 ? null : await r.json();
      if (!r.ok)
        throw new Error(
          typeof data?.error?.details === "string"
            ? data.error.details
            : JSON.stringify(data?.error?.details ?? data),
        );
      return data;
    },
    [csrf],
  );
  const act = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const loadSession = async () => {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to reach backend");
    const data = await res.json();
    setCsrf(data.csrfToken);
    setUser(data.user);
    setError("");
    setReady(true);
    return data;
  };
  useEffect(() => {
    let retries = 0;
    const attempt = () => {
      loadSession().catch(() => {
        if (retries < 3) {
          retries++;
          setTimeout(attempt, 800);
        } else {
          setError(
            "Cannot reach the backend. Check that the services are running.",
          );
          setReady(true);
        }
      });
    };
    attempt();
  }, []);
  const refreshProjects = useCallback(async () => {
    const [ps, os] = await Promise.all([
      api("/api/projects"),
      api("/api/organizations"),
    ]);
    setProjects(ps);
    setOrgs(os);
    setProject((old) =>
      ps.some((p: Row) => p.id === old) ? old : (ps[0]?.id ?? ""),
    );
  }, [api]);
  useEffect(() => {
    if (user) refreshProjects().catch((e) => setError(e.message));
  }, [user, refreshProjects]);

  // Load project connections in the background once per project
  useEffect(() => {
    if (!project) return;
    api("/api/v1/connections?project=" + project)
      .then((c) => {
        if (c) {
          setConnections(
            Array.isArray(c?.results) ? c.results : Array.isArray(c) ? c : [],
          );
        }
      })
      .catch(() => {});
  }, [project, api]);

  const tableCacheRef = useRef<Record<string, Row[]>>({});
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const refresh = useCallback(async () => {
    if (!project) return;
    const query = "?project=" + project;
    const map: Record<string, string> = {
      Connections: "connections",
      "API Keys": "keys",
      Inbox: "messages",
      Contacts: "contacts",
      "Workflow Builder": "workflows",
      Webhooks: "webhooks",
      Templates: "templates",
    };

    if (map[page]) {
      const cacheKey = `${project}:${page}`;
      const cached = tableCacheRef.current[cacheKey];
      if (cached && cached.length > 0) {
        setRows(cached);
      } else {
        setRows([]);
        setBusy(true);
      }

      try {
        const d = await api("/api/v1/" + map[page] + query);
        const list = Array.isArray(d?.results)
          ? d.results
          : Array.isArray(d)
            ? d
            : [];
        tableCacheRef.current[cacheKey] = list;
        setRows(list);
        if (map[page] === "connections") {
          setConnections(list);
        }
      } catch {
        if (!tableCacheRef.current[cacheKey]) setRows([]);
      } finally {
        setBusy(false);
      }
    } else if (
      page === "Overview" ||
      page === "Analytics" ||
      page === "Usage & Billing"
    ) {
      setBusy(true);
      try {
        const s = await api("/api/overview" + query).catch(() => null);
        if (s) setStats(s);
        setRows([]);
      } finally {
        setBusy(false);
      }
    } else if (page === "Team Members") {
      setBusy(true);
      try {
        const team = await api("/api/team" + query).catch(() => []);
        setRows(Array.isArray(team) ? team : team?.results || []);
      } finally {
        setBusy(false);
      }
    } else if (page === "Admin") {
      setBusy(true);
      try {
        setResult(await api("/api/platform").catch(() => null));
      } finally {
        setBusy(false);
      }
    } else {
      setRows([]);
    }
  }, [project, page, api]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    setResult(null);
    setSearch("");
    refresh().catch((e) => setError(e.message));
  }, [refresh]);

  useEffect(() => {
    if (!project || !user) return;
    const socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/projects/${project}`,
    );
    socket.onmessage = (e) => {
      const event = JSON.parse(e.data);
      setNotice(event.type.replaceAll(".", " · "));
      refreshRef.current().catch(() => {});
    };
    return () => socket.close();
  }, [project, user]);

  const mutate = async (path: string, data: Row, method = "POST") => {
    const res = await api(path + "?project=" + project, method, { ...data, project });
    setNotice("Saved successfully");
    setModal("");
    delete tableCacheRef.current[`${project}:${page}`];
    await refresh();
    return res;
  };
  const deleteProject = async (projId: string) => {
    act(async () => {
      await api("/api/projects?project=" + projId, "DELETE");
      setNotice("Project deleted successfully");
      const ps = await api("/api/projects");
      setProjects(ps);
      if (project === projId) {
        setProject(ps[0]?.id ?? "");
      }
    });
  };
  const fieldsForConnection: Field[] = [
    { name: "name", label: "Connection name", value: "Test Demo WhatsApp" },
    {
      name: "provider",
      label: "Provider",
      options: [
        {
          value: "baileys",
          label: "WhatsApp Multi-Device (QR Code Pairing · No Meta API Key)",
        },
        ...(active?.sandbox
          ? [{ value: "sandbox", label: "Sandbox · simulated delivery" }]
          : [{ value: "meta", label: "Official Meta Cloud API" }]),
      ],
    },
  ];
  const connectionOptions = connections
    .filter((c) => c.status === "CONNECTED")
    .map((c) => ({ value: c.id, label: c.name }));
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  const urlParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  if (!ready)
    return (
      <div className="boot-splash">
        <div className="boot-container">
          <div className="boot-logo-wrapper">
            <div className="boot-ripple boot-ripple-1" />
            <div className="boot-ripple boot-ripple-2" />
            <img
              src="/whatsbridge_avatar.jpg"
              alt="WhatsBridge Logo"
              className="boot-logo-img"
            />
          </div>
          <div className="boot-brand">
            WhatsBridge<span className="brand-dot">.</span>
          </div>
          <div className="boot-bar">
            <div className="boot-bar-fill" />
          </div>
          <p className="boot-status">Starting WhatsBridge workspace…</p>
        </div>
      </div>
    );
  if (!user)
    return (
      <div className="auth-layout">
        <section className="auth-story">
          <div className="brand">
            <img
              src="/whatsbridge_avatar.jpg"
              alt="WhatsBridge"
              className="brand-logo-img"
            />
            WhatsBridge<span className="brand-dot">.</span>
          </div>
          <div>
            <span className="eyebrow">BUILT FOR DEVELOPERS</span>
            <h1>
              Good conversations.
              <br />
              <em>Great infrastructure.</em>
            </h1>
            <p>
              One place to build, test, and manage messaging.
              <br />
              From your first sandbox message to official WhatsApp integrations.
            </p>
            <div className="auth-points">
              <span>
                <Check size={16} /> Tenant-isolated projects
              </span>
              <span>
                <Check size={16} /> Official Meta transport
              </span>
              <span>
                <Check size={16} /> A sandbox to build with confidence
              </span>
            </div>
          </div>
          <small>YOUR CODE. YOUR CUSTOMERS. CONNECTED.</small>
        </section>
        <section className="auth-form">
          <div className="auth-box">
            <span className="eyebrow">WELCOME TO WHATSBRIDGE</span>
            <h2>
              {authMode === "register"
                ? regStep === "verify"
                  ? "Enter verification code"
                  : "Create your workspace"
                : authMode === "forgot-password"
                  ? "Reset your password"
                  : "Welcome back"}
            </h2>
            <p className="muted">
              {authMode === "register"
                ? regStep === "verify"
                  ? `Enter the 6-digit code sent to your ${regChannel === "whatsapp" ? "WhatsApp" : "Email"} (${regEmail}).`
                  : "Start building with a free sandbox project."
                : "Sign in to your developer workspace."}
            </p>
            {error && (
              <div
                role="alert"
                className="error"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    loadSession().catch((e) => setError(e.message));
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "4px",
                    background: "rgba(239, 68, 68, 0.15)",
                    color: "inherit",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {notice && (
              <div role="status" className="notice">
                {notice}
              </div>
            )}
            {urlParams.has("verify") && (
              <button
                className="primary"
                onClick={() =>
                  act(async () => {
                    const d = await api("/api/auth/verify-email", "POST", {
                      token: urlParams.get("verify"),
                    });
                    setNotice(d.detail);
                    history.replaceState({}, "", "/");
                  })
                }
              >
                Verify email
              </button>
            )}
            {urlParams.has("reset") ? (
              <Form
                fields={[
                  {
                    name: "password",
                    label: "New password (12+ characters)",
                    type: "password",
                  },
                ]}
                submit={(d) =>
                  act(async () => {
                    const r = await api("/api/auth/reset-password", "POST", {
                      ...d,
                      token: urlParams.get("reset"),
                      uid: urlParams.get("uid"),
                    });
                    setNotice(r.detail);
                    history.replaceState({}, "", "/");
                  })
                }
                label="Reset password"
              />
            ) : authMode === "register" && regStep === "verify" ? (
              <Form
                key="verify-reg-otp"
                fields={[
                  {
                    name: "code",
                    label: `6-Digit Code (${regChannel === "whatsapp" ? "WhatsApp" : "Email"})`,
                    type: "text",
                    required: true,
                  },
                ]}
                submit={(d) =>
                  act(async () => {
                    setError("");
                    const r = await api("/api/auth/verify-register-otp", "POST", {
                      email: regEmail,
                      code: d.code,
                    });
                    setNotice(r.detail);
                    await loadSession();
                  })
                }
                label="Verify & Create Account"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRegStep("details");
                    }}
                    style={{ background: "none", border: "none", color: "var(--green, #25d366)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    ← Change details
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      act(async () => {
                        const r = await api("/api/auth/send-register-otp", "POST", {
                          email: regEmail,
                          channel: regChannel,
                        });
                        setNotice(r.detail + (r.sandbox_code ? ` (Code: ${r.sandbox_code})` : ""));
                      })
                    }
                    style={{ background: "none", border: "none", color: "var(--muted, #64748b)", cursor: "pointer", padding: 0 }}
                  >
                    Resend code
                  </button>
                </div>
              </Form>
            ) : authMode === "register" ? (
              <div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px", background: "rgba(0,0,0,0.04)", padding: "4px", borderRadius: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setRegChannel("whatsapp")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      background: regChannel === "whatsapp" ? "#ffffff" : "transparent",
                      color: regChannel === "whatsapp" ? "#16a34a" : "var(--muted, #64748b)",
                      boxShadow: regChannel === "whatsapp" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "15px" }}>💬</span> WhatsApp OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegChannel("email")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      background: regChannel === "email" ? "#ffffff" : "transparent",
                      color: regChannel === "email" ? "#2563eb" : "var(--muted, #64748b)",
                      boxShadow: regChannel === "email" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "15px" }}>✉️</span> Email OTP
                  </button>
                </div>
                <Form
                  key={`reg-${regChannel}`}
                  fields={[
                    { name: "email", label: "Email address", type: "email" },
                    ...(regChannel === "whatsapp"
                      ? [
                          {
                            name: "phone",
                            label: "WhatsApp phone number (e.g. +919876543210)",
                            type: "tel",
                            required: true,
                          },
                        ]
                      : []),
                    { name: "organization", label: "Organization name" },
                    { name: "password", label: "Password (12+ characters)", type: "password" },
                  ]}
                  submit={(d) =>
                    act(async () => {
                      setError("");
                      const r = await api("/api/auth/send-register-otp", "POST", {
                        ...d,
                        channel: regChannel,
                      });
                      setRegEmail(d.email as string);
                      setNotice(r.detail + (r.sandbox_code ? ` (Code: ${r.sandbox_code})` : ""));
                      setRegStep("verify");
                    })
                  }
                  label={regChannel === "whatsapp" ? "Send WhatsApp Code →" : "Send Email Code →"}
                />
              </div>
            ) : (
              <Form
                key={authMode}
                fields={[
                  { name: "email", label: "Email address", type: "email" },
                  ...(authMode !== "forgot-password"
                    ? [
                        {
                          name: "password",
                          label: "Password",
                          type: "password",
                        },
                      ]
                    : []),
                  ...(authMode === "login"
                    ? [
                        {
                          name: "code",
                          label: "Two-factor code (if enabled)",
                          required: false,
                        },
                      ]
                    : []),
                ]}
                submit={(d) =>
                  act(async () => {
                    setError("");
                    let token = csrf;
                    if (!token) {
                      const sess = await fetch("/api/auth/session", {
                        credentials: "include",
                      }).then((r) => r.json());
                      token = sess.csrfToken;
                      setCsrf(token);
                    }
                    const r = await api("/api/auth/" + authMode, "POST", d, {
                      "X-CSRFToken": token,
                    });
                    setNotice(r.detail);
                    if (authMode === "login") await loadSession();
                  })
                }
                label={authMode === "forgot-password" ? "Send reset link" : "Sign in"}
              />
            )}
            <div className="auth-links">
              <button
                onClick={() => {
                  setError("");
                  setRegStep("details");
                  setAuthMode(authMode === "login" ? "register" : "login");
                }}
              >
                {authMode === "login" ? "Create an account" : "Back to sign in"}
              </button>
              <button onClick={() => setAuthMode("forgot-password")}>
                Forgot password?
              </button>
            </div>
            <p className="fine">
              Development email links arrive in{" "}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                Mailpit
              </a>
              . Production uses your configured email provider.
            </p>
          </div>
        </section>
      </div>
    );
  return (
    <>
      <div className="shell">
      <aside className={mobile ? "sidebar open" : "sidebar"}>
        <a className="brand" href="#" onClick={() => setPage("Overview")}>
          <img
            src="/whatsbridge_avatar.jpg"
            alt="WhatsBridge"
            className="brand-logo-img"
          />
          WhatsBridge<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="avatar">{(active?.name ?? "W").slice(0, 1)}</span>
          <div>
            <strong>{active?.name ?? "Your workspace"}</strong>
            <small>
              {active?.sandbox ? "Sandbox workspace" : "Developer workspace"}
            </small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav>
          {nav.map(([group, items]) => (
            <div className="nav-group" key={group}>
              <span>{group}</span>
              {items
                .filter((n) => n !== "Admin" || user.is_staff)
                .map((n) => {
                  const Icon = icons[n];
                  return (
                    <button
                      key={n}
                      className={page === n ? "nav-item active" : "nav-item"}
                      onClick={() => {
                        setPage(n);
                        setMobile(false);
                        setError("");
                      }}
                    >
                      <Icon size={17} />
                      {n}
                      {n === "Connections" && (
                        <small>
                          {
                            connections.filter((c) => c.status === "CONNECTED")
                              .length
                          }
                        </small>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <Zap size={18} />
            <strong>Built for your next idea</strong>
            <p>
              Start in the sandbox.
              <br />
              Ship with a supported provider.
            </p>
            <button onClick={() => setPage("API Documentation")}>
              Read the quickstart <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="profile" onClick={() => setPage("Settings")}>
            <span className="avatar">
              {user.email?.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.first_name || "Developer"}</strong>
              <small>{user.email}</small>
            </span>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Toggle navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <i />
              {active?.sandbox ? "Sandbox" : "Live project"}
            </span>
            <button
              aria-label="Toggle color theme"
              onClick={() => document.documentElement.classList.toggle("dark")}
            >
              <Sun size={18} />
            </button>
            <button
              aria-label="Sign out"
              onClick={() =>
                act(async () => {
                  await api("/api/auth/logout", "POST", {});
                  await loadSession();
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Overview"
                  ? "YOUR WORKSPACE, CONNECTED"
                  : "WHATSBRIDGE CONSOLE"}
              </span>
              <h1>{page === "Overview" ? "Workspace overview" : page}</h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              <select
                aria-label="Active project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                    {p.sandbox ? " · sandbox" : ""}
                  </option>
                ))}
              </select>
              <button
                className="primary"
                onClick={() =>
                  setModal(
                    page === "Projects" || !project
                      ? "project"
                      : page === "Connections"
                        ? "connection"
                        : page === "API Keys"
                          ? "key"
                          : page === "Contacts"
                            ? "contact"
                            : page === "Templates"
                              ? "template"
                              : page === "Webhooks"
                                ? "webhook"
                                : page === "Team Members"
                                  ? "invite"
                                  : "project",
                  )
                }
              >
                <Plus size={16} />
                {page === "Connections"
                  ? "Add connection"
                  : page === "API Keys"
                    ? "Create key"
                    : page === "Contacts"
                      ? "Add contact"
                      : page === "Templates"
                        ? "Add template"
                        : page === "Webhooks"
                          ? "Add endpoint"
                          : page === "Team Members"
                            ? "Invite member"
                            : "New project"}
              </button>
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")}>Dismiss</button>
            </div>
          )}
          {urlParams.has("invite") && (
            <button
              className="primary"
              onClick={() =>
                act(async () => {
                  await api("/api/auth/accept-invitation", "POST", {
                    token: urlParams.get("invite"),
                  });
                  history.replaceState({}, "", "/");
                  await refreshProjects();
                  setNotice("Invitation accepted");
                })
              }
            >
              Accept team invitation
            </button>
          )}
          {!project && page !== "Projects" ? (
            <section className="card welcome">
              <h2>Make room for your first integration.</h2>
              <p>
                Create a project to get a sandbox, scoped API keys, and
                messaging tools.
              </p>
              <button className="primary" onClick={() => setModal("project")}>
                Create your first project <ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <section className="welcome">
                    <div>
                      <span className="pill">
                        <span />{" "}
                        {active?.sandbox
                          ? "SANDBOX ENVIRONMENT"
                          : "OFFICIAL PROVIDER ENVIRONMENT"}
                      </span>
                      <h2>
                        From a few lines of code
                        <br />
                        to a real conversation.
                      </h2>
                      <p>
                        {active?.sandbox
                          ? "Your sandbox is ready. Connect a transport, add a consenting contact, and send your first test message."
                          : "Manage your official transport and monitor confirmed provider events."}
                      </p>
                      <button
                        className="primary"
                        onClick={() => setPage("Send Message")}
                      >
                        Send a test message <ArrowRight size={16} />
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setPage("API Documentation")}
                      >
                        Explore the docs <ArrowUpRight size={15} />
                      </button>
                    </div>
                    <div className="code-card">
                      <div>
                        <span />
                        <span />
                        <span />
                        <small>your-next-idea.ts</small>
                      </div>
                      <pre>
                        <span className="code-comment">
                          // One request. A new conversation.
                        </span>
                        {`
await whatsbridge.messages.create({
  phone: "+15551234567",
  kind: "text",
  payload: { body: "Hello, world 👋" }
});`}
                      </pre>
                      <footer>
                        <i /> Server-side integration · see API documentation
                      </footer>
                    </div>
                  </section>
                  <div className="stat-grid">
                    {[
                      ["Messages queued", stats.messages ?? 0, Send],
                      [
                        "Active connections",
                        stats.connections ?? 0,
                        MessageCircle,
                      ],
                      ["Contacts", stats.contacts ?? 0, Contact],
                      [
                        "Monthly limit",
                        stats.subscription?.monthly_limit ?? 0,
                        Activity,
                      ],
                    ].map(([label, value, Icon]: any) => (
                      <div className="stat-card" key={label}>
                        <div>
                          <span>{label}</span>
                          <Icon size={17} />
                        </div>
                        <strong>{Number(value).toLocaleString()}</strong>
                        <small>
                          {label === "Monthly limit"
                            ? "Organization-wide message reservations"
                            : "From your project records"}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>Your connections</h2>
                          <p>Messaging transports for this project</p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setPage("Connections")}
                        >
                          View all <ArrowUpRight size={14} />
                        </button>
                      </div>
                      {connections.length ? (
                        connections.slice(0, 4).map((c) => (
                          <div className="connection-row" key={c.id}>
                            <span className="connection-icon">
                              <MessageCircle size={22} />
                            </span>
                            <div>
                              <strong>{c.name}</strong>
                              <small>
                                {c.provider === "sandbox"
                                  ? "Sandbox · simulated events"
                                  : "Meta WhatsApp Cloud API"}
                              </small>
                            </div>
                            <Badge>{c.status}</Badge>
                          </div>
                        ))
                      ) : (
                        <Empty text="Add a sandbox connection to start sending test messages." />
                      )}
                      <button
                        className="dashed-button"
                        onClick={() => setModal("connection")}
                      >
                        <Plus size={16} /> Add a connection
                      </button>
                    </section>
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>Get your integration going</h2>
                          <p>Three steps from setup to send</p>
                        </div>
                        <span className="step-count">
                          {
                            [
                              connections.length > 0,
                              (stats.contacts ?? 0) > 0,
                              (stats.messages ?? 0) > 0,
                            ].filter(Boolean).length
                          }
                          /3
                        </span>
                      </div>
                      {[
                        [
                          "Connect a transport",
                          "Choose sandbox or official Meta.",
                          "Connections",
                          connections.length > 0,
                        ],
                        [
                          "Add a consenting contact",
                          "Record permission before sending.",
                          "Contacts",
                          (stats.contacts ?? 0) > 0,
                        ],
                        [
                          "Send your first message",
                          "Try your integration end to end.",
                          "Send Message",
                          (stats.messages ?? 0) > 0,
                        ],
                      ].map(([title, desc, target, done], i) => (
                        <button
                          className="checklist"
                          key={String(title)}
                          onClick={() => setPage(String(target))}
                        >
                          <span className={done ? "step done" : "step"}>
                            {done ? <Check size={14} /> : i + 1}
                          </span>
                          <span>
                            <strong>{title}</strong>
                            <small>{desc}</small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </section>
                  </div>
                  <section className="resource-banner">
                    <div>
                      <Code2 size={23} />
                      <span>
                        <strong>Designed for the way you build.</strong>
                        <small>
                          REST API, signed webhooks, and integration examples in
                          your stack.
                        </small>
                      </span>
                    </div>
                    <button onClick={() => setPage("API Documentation")}>
                      Open developer docs <ArrowUpRight size={16} />
                    </button>
                  </section>
                </>
              )}
              {page === "Projects" && (
                <div className="project-grid">
                  {projects.map((p) => (
                    <div
                      className="card project-card"
                      key={p.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setProject(p.id);
                        setPage("Overview");
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                            marginBottom: 12,
                          }}
                        >
                          <Blocks size={24} />
                          <Badge>{p.sandbox ? "Sandbox" : "Live"}</Badge>
                        </div>
                        <h2 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>
                          {p.name}
                        </h2>
                        <code
                          style={{
                            fontSize: "11px",
                            opacity: 0.75,
                            display: "block",
                            marginBottom: 16,
                          }}
                        >
                          {p.id}
                        </code>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          width: "100%",
                          marginTop: "auto",
                          paddingTop: 12,
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          Open project <ArrowRight size={14} />
                        </span>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            style={{
                              padding: "5px 10px",
                              fontSize: "12px",
                              borderRadius: "6px",
                              background: "rgba(239, 68, 68, 0.1)",
                              color: "#ef4444",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Are you sure you want to delete project "${p.name}"? This action cannot be undone.`,
                                )
                              ) {
                                deleteProject(p.id);
                              }
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    className="card project-card"
                    onClick={() => setModal("project")}
                  >
                    <Plus />
                    <h2>New project</h2>
                    <p>Create a sandbox or live production project.</p>
                  </button>
                  <button
                    className="card project-card"
                    onClick={() => setModal("organization")}
                  >
                    <Plus />
                    <h2>New organization</h2>
                    <p>Create a separate workspace and team.</p>
                  </button>
                </div>
              )}
              {[
                "Connections",
                "API Keys",
                "Inbox",
                "Contacts",
                "Templates",
                "Webhooks",
                "Team Members",
              ].includes(page) && (
                <section className="card">
                  <div className="table-tools">
                    <h2>{page === "Inbox" ? "Conversation activity" : page}</h2>
                    <div className="search">
                      <Search size={16} />
                      <input
                        aria-label="Search records"
                        placeholder="Search records…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {busy && rows.length === 0 ? (
                    <p className="loading">Loading records…</p>
                  ) : !filtered.length && !busy ? (
                    <Empty />
                  ) : (
                    <div
                      className="table-scroll"
                      style={{
                        opacity: busy ? 0.65 : 1,
                        transition: "opacity 0.15s ease",
                      }}
                    >
                      <table>
                        <thead>
                          <tr>
                            <th>
                              {page === "Inbox"
                                ? "Recipient"
                                : page === "Webhooks"
                                  ? "Endpoint"
                                  : "Name"}
                            </th>
                            <th>Details</th>
                            <th>Status / role</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>
                                  {r.name || r.phone || r.url || r.user__email}
                                </strong>
                                <small>{r.id}</small>
                              </td>
                              <td>
                                {r.language ||
                                  r.provider ||
                                  r.prefix ||
                                  r.direction ||
                                  r.phone ||
                                  (r.events ?? []).join(", ") ||
                                  "Team member"}
                                {page === "Inbox" && (
                                  <small>{r.payload?.body || r.kind}</small>
                                )}
                              </td>
                              <td>
                                <Badge>
                                  {r.status ||
                                    r.role ||
                                    (page === "Templates"
                                      ? "local draft"
                                      : null) ||
                                    (page === "API Keys"
                                      ? r.revoked_at
                                        ? "revoked"
                                        : "active"
                                      : page === "Contacts"
                                        ? r.consent?.[0]?.granted
                                          ? "consent recorded"
                                          : "no consent"
                                        : "enabled")}
                                </Badge>
                              </td>
                              <td>
                                <div className="row-actions">
                                  {page === "Connections" && (
                                    <>
                                      {r.provider === "baileys" ? (
                                        <button
                                          style={{
                                            background:
                                              r.status === "CONNECTED"
                                                ? "linear-gradient(135deg, #059669, #047857)"
                                                : "linear-gradient(135deg, #10B981, #059669)",
                                            color: "#ffffff",
                                            fontWeight: 600,
                                            border: "none",
                                            padding: "6px 12px",
                                            borderRadius: "6px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                          }}
                                          onClick={() => {
                                            setSelected(r);
                                            setModal("baileys_qr");
                                          }}
                                        >
                                          <QrCode size={14} />
                                          {r.status === "CONNECTED"
                                            ? "Linked Device"
                                            : "Pair QR"}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setSelected(r);
                                            setModal("onboard");
                                          }}
                                          disabled={r.provider !== "meta"}
                                        >
                                          Onboard
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          act(() =>
                                            mutate(
                                              "/api/v1/connections/" +
                                                r.id +
                                                "/" +
                                                (r.provider === "baileys"
                                                  ? (r.status === "CONNECTED" ? "baileys_disconnect" : "baileys_qr")
                                                  : r.status === "CONNECTED"
                                                  ? "disconnect"
                                                  : "reconnect"),
                                              {},
                                            ),
                                          )
                                        }
                                      >
                                        {r.status === "CONNECTED"
                                          ? "Disconnect"
                                          : "Reconnect"}
                                      </button>
                                      <button
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: "6px",
                                          background: "rgba(239, 68, 68, 0.1)",
                                          color: "#ef4444",
                                          border: "1px solid rgba(239, 68, 68, 0.25)",
                                          fontSize: "12px",
                                          fontWeight: 500,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "5px",
                                        }}
                                        onClick={() => {
                                          if (
                                            confirm(
                                              `Are you sure you want to delete connection "${r.name}"?`,
                                            )
                                          ) {
                                            act(() =>
                                              mutate(
                                                "/api/v1/connections/" + r.id,
                                                {},
                                                "DELETE",
                                              ),
                                            );
                                          }
                                        }}
                                      >
                                        <Trash2 size={13} /> Delete
                                      </button>
                                    </>
                                  )}
                                  {page === "API Keys" && (
                                    <>
                                      <button
                                        disabled={!!r.revoked_at}
                                        onClick={() =>
                                          act(async () => {
                                            setResult(
                                              await api(
                                                "/api/v1/keys/" +
                                                  r.id +
                                                  "/rotate?project=" +
                                                  project,
                                                "POST",
                                                { project },
                                              ),
                                            );
                                            await refresh();
                                          })
                                        }
                                      >
                                        Rotate
                                      </button>
                                      <button
                                        disabled={!!r.revoked_at}
                                        onClick={() =>
                                          act(() =>
                                            mutate(
                                              "/api/v1/keys/" + r.id,
                                              {},
                                              "DELETE",
                                            ),
                                          )
                                        }
                                      >
                                        Revoke
                                      </button>
                                    </>
                                  )}
                                  {page === "Templates" && (
                                    <button
                                      onClick={() =>
                                        setResult({
                                          ...r,
                                          note: "Local draft only. Obtain approval in Meta WhatsApp Manager before live use.",
                                        })
                                      }
                                    >
                                      Inspect draft
                                    </button>
                                  )}
                                  {page === "Contacts" && (
                                    <button
                                      onClick={() => {
                                        setSelected(r);
                                        setModal("consent");
                                      }}
                                    >
                                      Consent
                                    </button>
                                  )}
                                  {page === "Webhooks" && (
                                    <>
                                      <button
                                        onClick={() =>
                                          act(async () =>
                                            setResult(
                                              await api(
                                                "/api/v1/webhooks/" +
                                                  r.id +
                                                  "/history?project=" +
                                                  project,
                                              ),
                                            ),
                                          )
                                        }
                                      >
                                        History
                                      </button>
                                      <button
                                        onClick={() =>
                                          act(async () =>
                                            setResult(
                                              await api(
                                                "/api/v1/webhooks/" +
                                                  r.id +
                                                  "/rotate?project=" +
                                                  project,
                                                "POST",
                                                { project },
                                              ),
                                            ),
                                          )
                                        }
                                      >
                                        Rotate secret
                                      </button>
                                      <button
                                        onClick={() =>
                                          act(() =>
                                            mutate(
                                              "/api/v1/webhooks/" + r.id,
                                              {},
                                              "DELETE",
                                            ),
                                          )
                                        }
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                  {page === "Team Members" &&
                                    r.role !== "owner" && (
                                      <button
                                        onClick={() =>
                                          act(() =>
                                            mutate(
                                              "/api/team",
                                              { membership: r.id },
                                              "DELETE",
                                            ),
                                          )
                                        }
                                      >
                                        Remove
                                      </button>
                                    )}
                                  {page === "Inbox" && (
                                    <button onClick={() => setResult(r)}>
                                      Inspect
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="fine">
                    Showing up to 50 records. The REST API supports pagination.
                  </p>
                </section>
              )}
              {page === "Send Message" && (
                <section className="card narrow">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2>Create a message</h2>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                      Test Demo Ready
                    </span>
                  </div>
                  <p className="muted" style={{ marginBottom: 16 }}>
                    Direct delivery via WhatsApp Multi-Device (Baileys) or official Meta Cloud API.
                  </p>
                  <Form
                    fields={[
                      {
                        name: "connection",
                        label: "Connection",
                        options: connectionOptions,
                      },
                      {
                        name: "phone",
                        label: "Recipient · E.164",
                        value: "+919876543210",
                      },
                      {
                        name: "body",
                        label: "Message Content",
                        type: "textarea",
                        value: "*🚀 TEST DEMO - MESSAGE CONFIRMED! 🚀*\n\nHello Valued Customer,\nYour Test Demo notification #TD-1001 has been confirmed!\n\n📦 Package: Standard Test Suite\n⚡ Transport: WhatsApp Multi-Device (Direct Bridge)\n💰 Status: Delivered\n\n_Reply to this WhatsApp chat for test demo support!_",
                      },
                    ]}
                    label="Send WhatsApp Message"
                    submit={(d) =>
                      act(async () => {
                        setResult(
                          await api(
                            "/api/v1/messages?project=" + project,
                            "POST",
                            {
                              project,
                              connection: d.connection,
                              phone: d.phone,
                              kind: "text",
                              payload: { body: d.body },
                            },
                            { "Idempotency-Key": crypto.randomUUID() },
                          ),
                        );
                        await refresh();
                      })
                    }
                  />
                  <p className="fine">
                    Pro-tip: If using a WhatsApp Multi-Device connection, messages are sent directly from your own paired phone number without Meta per-message fees.
                  </p>
                </section>
              )}
              {page === "OTP Verification" && (
                <div className="two-col">
                  <section className="card">
                    <h2>1. Create a challenge</h2>
                    <p className="muted">
                      Sandbox codes appear once in the result. Live OTP requires
                      an approved authentication template.
                    </p>
                    <Form
                      fields={[
                        {
                          name: "connection",
                          label: "Connection",
                          options: connectionOptions,
                        },
                        { name: "phone", label: "Phone number" },
                        {
                          name: "template",
                          label: "Approved template (live only)",
                          required: false,
                        },
                      ]}
                      label="Send OTP"
                      submit={(d) =>
                        act(async () =>
                          setResult(
                            await api(
                              "/api/v1/otp/send?project=" + project,
                              "POST",
                              { ...d, project },
                            ),
                          ),
                        )
                      }
                    />
                  </section>
                  <section className="card">
                    <h2>2. Verify the code</h2>
                    <Form
                      key={result?.challenge_id}
                      fields={[
                        {
                          name: "challenge_id",
                          label: "Challenge ID",
                          value: result?.challenge_id,
                        },
                        { name: "code", label: "Six-digit code" },
                      ]}
                      label="Verify once"
                      submit={(d) =>
                        act(async () => {
                          setResult(
                            await api(
                              "/api/v1/otp/verify?project=" + project,
                              "POST",
                              { ...d, project },
                            ),
                          );
                        })
                      }
                    />
                  </section>
                </div>
              )}
              {page === "Workflow Builder" && (
                <WorkflowEditor
                  rows={rows}
                  api={api}
                  project={project}
                  connections={connectionOptions}
                  act={act}
                  refresh={refresh}
                  setResult={setResult}
                />
              )}
              {page === "AI Assistant" && (
                <section className="card narrow">
                  <span className="pill">
                    <Sparkles size={13} /> HUMAN REVIEW REQUIRED
                  </span>
                  <h2>A thoughtful first draft</h2>
                  <p className="muted">
                    Gemini must be configured by your platform administrator and
                    enabled in project settings. Generated replies are
                    suggestions.
                  </p>
                  <Form
                    fields={[
                      {
                        name: "mode",
                        label: "Task",
                        options: ["reply", "summary", "intent", "workflow"].map(
                          (v) => ({ value: v, label: v }),
                        ),
                      },
                      {
                        name: "prompt",
                        label:
                          "Customer question or conversation · English / Malayalam",
                        type: "textarea",
                      },
                    ]}
                    label="Generate suggestion"
                    submit={(d) =>
                      act(async () =>
                        setResult(
                          await api("/api/ai?project=" + project, "POST", {
                            ...d,
                            project,
                          }),
                        ),
                      )
                    }
                  />
                </section>
              )}
              {["Analytics", "Usage & Billing"].includes(page) && (
                <div className="two-col">
                  <section className="card">
                    <h2>
                      {page === "Analytics"
                        ? "Message status"
                        : "Usage accounting"}
                    </h2>
                    {(page === "Analytics"
                      ? stats.by_status
                      : stats.usage
                    )?.map((r: Row) => (
                      <div className="usage-row" key={r.status || r.kind}>
                        <span>{r.status || r.kind}</span>
                        <strong>{r.count ?? r.quantity}</strong>
                        <div className="meter">
                          <i
                            style={{
                              width: `${Math.min(100, (100 * (r.count ?? r.quantity)) / Math.max(stats.messages ?? 1, 1))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </section>
                  <section className="card">
                    <h2>{stats.subscription?.plan ?? "Sandbox"} plan</h2>
                    <p className="metric">
                      {stats.subscription?.monthly_limit?.toLocaleString()}
                    </p>
                    <p className="muted">
                      Monthly organization-wide message reservations. Accepted
                      sends are tracked separately. Payment collection is not
                      connected.
                    </p>
                  </section>
                </div>
              )}
              {page === "Settings" && (
                <div className="two-col">
                  <section className="card">
                    <h2>Your account</h2>
                    <Form
                      fields={[
                        {
                          name: "first_name",
                          label: "Display name",
                          value: user.first_name,
                          required: false,
                        },
                      ]}
                      submit={(d) =>
                        act(async () => {
                          await api("/api/auth/profile", "POST", d);
                          await loadSession();
                          setNotice("Profile saved");
                        })
                      }
                    />
                    <hr />
                    <h3>Two-factor authentication</h3>
                    <p className="muted">
                      {user.totp_enabled
                        ? "Enabled"
                        : "Protect sign-in with an authenticator app."}
                    </p>
                    {!user.totp_enabled && (
                      <>
                        <button
                          onClick={() =>
                            act(async () =>
                              setResult(
                                await api("/api/auth/2fa-setup", "POST", {}),
                              ),
                            )
                          }
                        >
                          Generate authenticator secret
                        </button>
                        <Form
                          fields={[
                            { name: "code", label: "Authenticator code" },
                          ]}
                          label="Enable two-factor"
                          submit={(d) =>
                            act(async () => {
                              await api("/api/auth/2fa-enable", "POST", d);
                              await loadSession();
                            })
                          }
                        />
                      </>
                    )}
                  </section>
                  <section className="card">
                    <h2>Project settings</h2>
                    <Form
                      key={project}
                      fields={[
                        {
                          name: "name",
                          label: "Project name",
                          value: active?.name,
                        },
                        {
                          name: "ai_enabled",
                          label: "AI suggestions",
                          value: String(active?.ai_enabled),
                          options: [
                            { value: "false", label: "Disabled" },
                            { value: "true", label: "Enabled" },
                          ],
                        },
                        {
                          name: "faq",
                          label: "Private FAQ knowledge base",
                          type: "textarea",
                          value: active?.faq,
                          required: false,
                        },
                      ]}
                      submit={(d) =>
                        act(async () => {
                          await api(
                            "/api/projects?project=" + project,
                            "PATCH",
                            {
                              ...d,
                              ai_enabled: d.ai_enabled === "true",
                              project,
                            },
                          );
                          await refreshProjects();
                          setNotice("Settings saved");
                        })
                      }
                    />
                  </section>
                </div>
              )}
              {page === "Admin" && (
                <section className="card">
                  <h2>Organization controls</h2>
                  <p className="muted">
                    All changes are audited. Detailed records are available in
                    Django administration.
                  </p>
                  <Form
                    fields={[
                      {
                        name: "organization",
                        label: "Organization",
                        options: (result?.organizations ?? []).map(
                          (o: Row) => ({ value: o.id, label: o.name }),
                        ),
                      },
                      {
                        name: "suspended",
                        label: "Access",
                        options: [
                          { value: "false", label: "Active" },
                          { value: "true", label: "Suspended" },
                        ],
                      },
                      {
                        name: "monthly_limit",
                        label: "Monthly message limit",
                        type: "number",
                        value: "10000",
                      },
                    ]}
                    submit={(d) =>
                      act(async () => {
                        await api("/api/platform", "POST", {
                          ...d,
                          suspended: d.suspended === "true",
                          monthly_limit: Number(d.monthly_limit),
                        });
                        await refresh();
                      })
                    }
                  />
                  <a href="/admin/" target="_blank" rel="noreferrer">
                    Open Django administration ↗
                  </a>
                </section>
              )}
              {page === "API Playground" && (
                <section className="card">
                  <h2>Session-authenticated request</h2>
                  <p className="muted">
                    No API key is stored in the browser. Your backend
                    integrations should use a scoped Bearer key.
                  </p>
                  <Form
                    fields={[
                      {
                        name: "method",
                        label: "Method",
                        options: ["GET", "POST"].map((v) => ({
                          value: v,
                          label: v,
                        })),
                      },
                      {
                        name: "path",
                        label: "API path",
                        value: "/api/v1/messages",
                      },
                      {
                        name: "body",
                        label: "JSON request body",
                        type: "textarea",
                        value: "{}",
                      },
                    ]}
                    label="Run request"
                    submit={(d) =>
                      act(async () => {
                        if (!d.path.startsWith("/api/v1/"))
                          throw new Error("Use a /api/v1/ path");
                        setResult(
                          await api(
                            d.path + "?project=" + project,
                            d.method,
                            d.method === "POST"
                              ? { ...JSON.parse(d.body), project }
                              : undefined,
                            { "Idempotency-Key": crypto.randomUUID() },
                          ),
                        );
                      })
                    }
                  />
                </section>
              )}
              {page === "API Documentation" && (
                <section className="card docs">
                  <span className="eyebrow">QUICKSTART</span>
                  <h2>Your first message in four steps</h2>
                  <ol>
                    <li>Create a project and connect its sandbox transport.</li>
                    <li>Add a contact and record messaging consent.</li>
                    <li>
                      Create a project API key with <code>messages:send</code>.
                    </li>
                    <li>Call the API from your application backend.</li>
                  </ol>
                  <pre>{`curl -X POST "$BASE_URL/api/v1/messages" \
  -H "Authorization: Bearer $WHATSBRIDGE_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-confirmation" \
  -d '{"connection":"CONNECTION_ID","phone":"+15551234567",
       "kind":"text","payload":{"body":"Your order is confirmed."}}'`}</pre>
                  <p>
                    A 202 response means queued, not delivered. Follow message
                    state or verify signed webhook events. Sandbox delivery
                    events are explicitly simulated.
                  </p>
                  <a
                    className="primary"
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open interactive API reference <ArrowUpRight size={15} />
                  </a>
                  <h3>Safe webhook consumption</h3>
                  <p>
                    Verify HMAC-SHA256 over{" "}
                    <code>timestamp + "." + rawBody</code>, enforce a
                    five-minute timestamp window, and persist the event ID to
                    reject replays. Return a 2xx status after storing the event.
                  </p>
                  <h3>Official Meta onboarding</h3>
                  <p>
                    Create a live project, add a Meta connection, then onboard
                    server-side credentials. Configure the callback at{" "}
                    <code>/api/providers/meta/CONNECTION_ID</code>. QR pairing
                    and unofficial WhatsApp Web OTP are not supported.
                  </p>
                  <h3>Integration examples</h3>
                  <p>
                    Python, TypeScript, Django, Next.js, Laravel, and a Postman
                    collection are included in the repository&apos;s docs
                    directory.
                  </p>
                </section>
              )}
              {result && page !== "Admin" && (
                <section className="card result">
                  <div className="section-heading">
                    <h2>
                      {result.secret
                        ? "Copy this secret now · shown once"
                        : "Request result"}
                    </h2>
                    <button onClick={() => setResult(null)}>Close</button>
                  </div>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </section>
              )}
            </>
          )}
          <footer className="footer">
            <span>
              WhatsBridge <span>·</span> Developer platform
            </span>
            <span>
              <i />{" "}
              {active?.sandbox
                ? "Sandbox · no real messages sent"
                : "Official transport · provider rules apply"}
            </span>
          </footer>
        </main>
      </div>
    </div>
    {modal && (
      <div
        className="modal-backdrop"
        onClick={() => setModal("")}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          overflowY: "auto",
        }}
      >
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            minHeight: "fit-content",
            height: "auto",
            width: "100%",
            maxWidth: "480px",
            margin: "auto",
            background: "#ffffff",
            borderRadius: "20px",
            padding: "32px 32px",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.14), 0 0 0 1px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflowY: "auto",
          }}
        >
          <div
            className="section-heading"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              marginBottom: "24px",
              paddingBottom: "0px",
              borderBottom: "none",
              flexShrink: 0,
            }}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.3px", color: "#111827", margin: 0 }}>
              {modal === "project"
                ? "Create project"
                : modal === "key"
                ? "Create an API key"
                : modal === "onboard"
                  ? "Official Meta onboarding"
                  : modal === "baileys_qr"
                    ? "Link WhatsApp Device (No Meta API)"
                    : modal === "consent"
                      ? "Record recipient consent"
                      : "Create " + modal}
            </h2>
            <button
              className="modal-close"
              onClick={() => setModal("")}
              aria-label="Close dialog"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                background: "#ffffff",
                color: "#4B5563",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
            {modal === "project" && (
              <Form
                fields={[
                  { name: "name", label: "Project name" },
                  {
                    name: "organization",
                    label: "Organization",
                    options: orgs.map((o) => ({
                      value: o.organization_id,
                      label: o.organization__name,
                    })),
                  },
                  {
                    name: "sandbox",
                    label: "Environment",
                    options: [
                      { value: "true", label: "Sandbox · simulated messages" },
                      { value: "false", label: "Live · official Meta" },
                    ],
                  },
                ]}
                submit={(d) =>
                  act(async () => {
                    await api("/api/projects", "POST", {
                      ...d,
                      sandbox: d.sandbox === "true",
                    });
                    await refreshProjects();
                    setModal("");
                  })
                }
              />
            )}
            {modal === "organization" && (
              <Form
                fields={[{ name: "name", label: "Organization name" }]}
                submit={(d) =>
                  act(async () => {
                    await api("/api/organizations", "POST", d);
                    await refreshProjects();
                    setModal("");
                  })
                }
              />
            )}
            {modal === "connection" && (
              <Form
                fields={fieldsForConnection}
                submit={(d) => act(() => mutate("/api/v1/connections", d))}
              />
            )}
            {modal === "key" && (
              <Form
                fields={[
                  { name: "name", label: "Key name" },
                  {
                    name: "scopes",
                    label: "Scopes (comma-separated)",
                    value: "messages:send,messages:read,connections:read",
                  },
                  {
                    name: "expires_at",
                    label: "Expires (ISO date/time, optional)",
                    required: false,
                  },
                ]}
                submit={(d) =>
                  act(async () => {
                    const body = {
                      name: d.name,
                      scopes: d.scopes.split(",").map((s: string) => s.trim()),
                      ...(d.expires_at ? { expires_at: d.expires_at } : {}),
                    };
                    const r = await api(
                      "/api/v1/keys?project=" + project,
                      "POST",
                      { ...body, project },
                    );
                    await refresh();
                    setResult(r);
                    setModal("");
                  })
                }
              />
            )}
            {modal === "template" && (
              <Form
                fields={[
                  {
                    name: "name",
                    label: "Template name (lowercase and underscores)",
                  },
                  { name: "language", label: "Language", value: "en_US" },
                  {
                    name: "category",
                    label: "Category",
                    options: ["utility", "authentication", "marketing"].map(
                      (v) => ({ value: v, label: v }),
                    ),
                  },
                  {
                    name: "components",
                    label: "Meta components JSON",
                    type: "textarea",
                    value: "[]",
                  },
                ]}
                submit={(d) =>
                  act(() =>
                    mutate("/api/v1/templates", {
                      ...d,
                      components: JSON.parse(d.components),
                    }),
                  )
                }
              >
                <p className="fine">
                  Saved as a local draft. This does not submit to Meta or confer
                  provider approval.
                </p>
              </Form>
            )}
            {modal === "contact" && (
              <Form
                fields={[
                  { name: "name", label: "Contact name" },
                  { name: "phone", label: "Phone · E.164" },
                ]}
                submit={(d) => act(() => mutate("/api/v1/contacts", d))}
              />
            )}
            {modal === "consent" && (
              <Form
                fields={[
                  {
                    name: "purpose",
                    label: "Purpose",
                    options: [
                      { value: "messaging", label: "Messaging" },
                      { value: "otp", label: "Verification OTP" },
                    ],
                  },
                  {
                    name: "granted",
                    label: "Permission",
                    options: [
                      { value: "true", label: "Granted" },
                      { value: "false", label: "Revoked" },
                    ],
                  },
                  {
                    name: "basis",
                    label: "Source / evidence of authorization",
                    type: "textarea",
                  },
                ]}
                submit={(d) =>
                  act(() =>
                    mutate("/api/v1/contacts/" + selected?.id + "/consent", {
                      ...d,
                      granted: d.granted === "true",
                    }),
                  )
                }
              />
            )}
            {modal === "webhook" && (
              <Form
                fields={[
                  {
                    name: "url",
                    label: "Approved HTTPS endpoint",
                    type: "url",
                  },
                  {
                    name: "events",
                    label: "Events (comma-separated)",
                    value: "message.sent,message.delivered,message.failed",
                  },
                ]}
                submit={(d) =>
                  act(async () => {
                    const r = await api(
                      "/api/v1/webhooks?project=" + project,
                      "POST",
                      {
                        project,
                        url: d.url,
                        events: d.events
                          .split(",")
                          .map((s: string) => s.trim()),
                      },
                    );
                    await refresh();
                    setResult(r);
                    setModal("");
                  })
                }
              />
            )}
            {modal === "invite" && (
              <Form
                fields={[
                  { name: "email", label: "Email", type: "email" },
                  {
                    name: "role",
                    label: "Role",
                    options: ["developer", "admin", "viewer"].map((v) => ({
                      value: v,
                      label: v,
                    })),
                  },
                ]}
                submit={(d) => act(() => mutate("/api/team", d))}
              />
            )}
            {modal === "onboard" && (
              <Form
                fields={[
                  { name: "phone_number_id", label: "Meta phone number ID" },
                  {
                    name: "access_token",
                    label: "System user access token",
                    type: "password",
                  },
                  {
                    name: "app_secret",
                    label: "Meta app secret",
                    type: "password",
                  },
                  {
                    name: "verify_token",
                    label: "Webhook verify token",
                    type: "password",
                  },
                ]}
                submit={(d) =>
                  act(() =>
                    mutate(
                      "/api/v1/connections/" + selected?.id + "/onboard",
                      d,
                    ),
                  )
                }
              >
                <p className="fine">
                  Credentials are submitted over your connection and encrypted
                  on the server. They are never returned by the API. Use HTTPS
                  for live deployments.
                </p>
              </Form>
            )}
            {modal === "baileys_qr" && selected && (
              <BaileysQrModal
                connection={selected}
                api={api}
                refresh={refresh}
                close={() => setModal("")}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
function WorkflowEditor({
  rows,
  api,
  project,
  connections,
  act,
  refresh,
  setResult,
}: {
  rows: Row[];
  api: (path: string, method?: string, body?: Row) => Promise<any>;
  project: string;
  connections: { value: string; label: string }[];
  act: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  setResult: (r: any) => void;
}) {
  const [id, setId] = useState(""),
    [name, setName] = useState("Order confirmation"),
    [nodes, setNodes] = useState<Row[]>([
      { type: "trigger", event: "manual" },
      { type: "end" },
    ]),
    [drag, setDrag] = useState<number | null>(null),
    [phone, setPhone] = useState("");
  const types = [
    "trigger",
    "send_message",
    "wait",
    "condition",
    "http_request",
    "webhook",
    "ai_response",
    "update_contact",
    "notify_admin",
    "end",
  ];
  const save = async () => {
    const r = await api(
      "/api/v1/workflows" + (id ? "/" + id : "") + "?project=" + project,
      id ? "PATCH" : "POST",
      { project, name, graph: nodes },
    );
    setId(r.id);
    await refresh();
    return r.id;
  };
  const change = (i: number, k: string, v: any) =>
    setNodes(nodes.map((n, j) => (j === i ? { ...n, [k]: v } : n)));
  return (
    <section className="workflow-layout">
      <aside className="card node-palette">
        <h3>Node library</h3>
        <p className="muted">Add a step. Drag to reorder.</p>
        {types.map((type) => (
          <button
            key={type}
            onClick={() =>
              setNodes([
                ...nodes,
                {
                  type,
                  ...(type === "wait"
                    ? { seconds: 60 }
                    : type === "send_message"
                      ? {
                          connection: connections[0]?.value,
                          payload: { body: "Thanks for your order." },
                        }
                      : type === "condition"
                        ? { field: "consent", equals: true }
                        : {}),
                },
              ])
            }
          >
            <Plus size={14} />
            {type.replaceAll("_", " ")}
          </button>
        ))}
        <hr />
        <h3>Saved workflows</h3>
        {rows.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setId(r.id);
              setName(r.name);
              setNodes(r.graph);
            }}
          >
            {r.name}
            <Badge>{r.status}</Badge>
          </button>
        ))}
      </aside>
      <div className="card workflow-canvas">
        <div className="workflow-toolbar">
          <input
            aria-label="Workflow name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={() =>
              act(async () => {
                setId("");
                setName("New workflow");
                setNodes([{ type: "trigger" }, { type: "end" }]);
              })
            }
          >
            New
          </button>
          <button
            onClick={() =>
              act(async () => {
                await save();
              })
            }
          >
            Save draft
          </button>
          <button
            className="primary"
            onClick={() =>
              act(async () => {
                const key = await save();
                await api(
                  "/api/v1/workflows/" + key + "/publish?project=" + project,
                  "POST",
                  { project },
                );
                await refresh();
              })
            }
          >
            Publish <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="nodes">
          {nodes.map((n, i) => (
            <div
              className="workflow-node"
              key={i}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag === null) return;
                const a = [...nodes];
                const [item] = a.splice(drag, 1);
                a.splice(i, 0, item);
                setNodes(a);
                setDrag(null);
              }}
            >
              <div className="node-title">
                <GripVertical size={16} />
                <span className="node-number">{i + 1}</span>
                <strong>{n.type.replaceAll("_", " ")}</strong>
                <button
                  aria-label="Move step up"
                  disabled={i === 0}
                  onClick={() => {
                    const a = [...nodes];
                    [a[i - 1], a[i]] = [a[i], a[i - 1]];
                    setNodes(a);
                  }}
                >
                  ↑
                </button>
                <button
                  aria-label="Remove step"
                  onClick={() => setNodes(nodes.filter((_, j) => i !== j))}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {n.type === "trigger" && (
                <select
                  value={n.event ?? "manual"}
                  onChange={(e) => change(i, "event", e.target.value)}
                >
                  <option value="manual">Manual / API trigger</option>
                  <option value="message.received">Incoming message</option>
                </select>
              )}
              {n.type === "send_message" && (
                <>
                  <select
                    aria-label="Connection"
                    value={n.connection ?? ""}
                    onChange={(e) => change(i, "connection", e.target.value)}
                  >
                    <option value="">Select connection</option>
                    {connections.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    aria-label="Message body"
                    value={n.payload?.body ?? ""}
                    onChange={(e) =>
                      change(i, "payload", { body: e.target.value })
                    }
                  />
                </>
              )}
              {n.type === "wait" && (
                <label className="field">
                  Wait seconds
                  <input
                    type="number"
                    min={0}
                    max={604800}
                    value={n.seconds ?? 60}
                    onChange={(e) =>
                      change(i, "seconds", Number(e.target.value))
                    }
                  />
                </label>
              )}
              {n.type === "condition" && (
                <>
                  <input
                    aria-label="Context field"
                    value={n.field ?? ""}
                    onChange={(e) => change(i, "field", e.target.value)}
                  />
                  <input
                    aria-label="Equals value"
                    value={String(n.equals ?? "")}
                    onChange={(e) => change(i, "equals", e.target.value)}
                  />
                  <small>
                    Stop this linear run if the context value does not match.
                  </small>
                </>
              )}
              {["http_request", "webhook"].includes(n.type) && (
                <input
                  aria-label="Approved HTTPS URL"
                  placeholder="https://approved.example.com/event"
                  value={n.url ?? ""}
                  onChange={(e) => change(i, "url", e.target.value)}
                />
              )}{" "}
              {n.type === "update_contact" && (
                <input
                  aria-label="New contact name"
                  value={n.name ?? ""}
                  onChange={(e) => change(i, "name", e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="workflow-run">
          <input
            aria-label="Workflow recipient"
            placeholder="Recipient +15551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            onClick={() =>
              act(async () => {
                const key = await save();
                setResult(
                  await api(
                    "/api/v1/workflows/" + key + "/run?project=" + project,
                    "POST",
                    { project, test_mode: true, context: { phone } },
                  ),
                );
              })
            }
          >
            <Play size={14} /> Test draft
          </button>
          <button
            disabled={!id}
            onClick={() =>
              act(async () =>
                setResult(
                  await api(
                    "/api/v1/workflows/" + id + "/run?project=" + project,
                    "POST",
                    { project, context: { phone } },
                  ),
                ),
              )
            }
          >
            Run published
          </button>
          <button
            disabled={!id}
            onClick={() =>
              act(async () => {
                setResult(
                  await api(
                    "/api/v1/workflows/" + id + "/history?project=" + project,
                  ),
                );
              })
            }
          >
            Execution history
          </button>
          <button
            disabled={!id}
            onClick={() =>
              act(async () => {
                await api(
                  "/api/v1/workflows/" + id + "/pause?project=" + project,
                  "POST",
                  { project },
                );
                await refresh();
              })
            }
          >
            Pause
          </button>
          <button
            disabled={!id}
            onClick={() =>
              act(async () => {
                await api(
                  "/api/v1/workflows/" + id + "/resume?project=" + project,
                  "POST",
                  { project },
                );
                await refresh();
              })
            }
          >
            Resume
          </button>
        </div>
        <p className="fine">
          Test mode requires sandbox transport, skips waits and external HTTP
          calls. AI nodes still consume the configured AI budget. Notify Admin
          records an audit event. This editor supports ordered flows, not
          branching graphs.
        </p>
      </div>
    </section>
  );
}

function BaileysQrModal({
  connection,
  api,
  refresh,
  close,
}: {
  connection: Row;
  api: (path: string, method?: string, body?: any) => Promise<any>;
  refresh: () => Promise<void>;
  close: () => void;
}) {
  const [data, setData] = useState<{
    status: string;
    qr: string | null;
    phone: string | null;
    name: string | null;
    detail?: string | null;
    error?: string | null;
  }>({
    status: "connecting",
    qr: null,
    phone: null,
    name: null,
    detail: null,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("+919876543210");
  const [testTemplate, setTestTemplate] = useState("order");
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const fetchStatus = useCallback(
    async (refreshSession = false) => {
      try {
        setLoading(true);
        const proj = connection.project || "";
        const endpoint =
          "/api/v1/connections/" +
          connection.id +
          "/baileys_qr?project=" +
          proj;
        const res = await api(
          endpoint,
          refreshSession ? "POST" : "GET",
        );
        if (res) setData(res);
        if (res?.status === "connected") {
          await refresh();
        }
      } catch (err: any) {
        console.error("Failed to query Baileys:", err);
        setData((prev: any) => ({
          ...prev,
          detail: "Connecting to WhatsApp service… retrying shortly",
        }));
      } finally {
        setLoading(false);
      }
    },
    [connection.id, connection.project, api, refresh],
  );

  useEffect(() => {
    fetchStatus(true);
    const interval = setInterval(() => {
      if (data.status !== "connected") {
        fetchStatus(false);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchStatus, data.status]);

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      await api(
        "/api/v1/connections/" +
          connection.id +
          "/baileys_disconnect?project=" +
          (connection.project || ""),
        "POST",
      );
      await refresh();
      await fetchStatus(true);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = data.status === "connected";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "8px 0" }}>
      {/* Status banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderRadius: "10px",
          background: isConnected
            ? "rgba(16, 185, 129, 0.12)"
            : "rgba(59, 130, 246, 0.12)",
          border: isConnected
            ? "1px solid rgba(16, 185, 129, 0.3)"
            : "1px solid rgba(59, 130, 246, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isConnected ? (
            <CheckCircle2 size={20} color="#10b981" />
          ) : (
            <Smartphone size={20} color="#3b82f6" />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: "14px" }}>
              {isConnected
                ? "Connected as +" + (data.phone || "Active Device")
                : data.status === "qr_ready"
                ? "Scan QR Code with WhatsApp"
                : "Initializing Multi-Device Socket…"}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.75 }}>
              {isConnected
                ? "Ready to dispatch Test Demo notifications directly without Meta API"
                : "Direct WhatsApp Multi-Device Protocol (Baileys)"}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          disabled={loading}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Main Content Area */}
      {!isConnected ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
            padding: "16px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {data.qr ? (
            <div
              style={{
                padding: "12px",
                background: "#ffffff",
                borderRadius: "14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                display: "inline-block",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.qr}
                alt="WhatsApp QR Code"
                style={{
                  width: "240px",
                  height: "240px",
                  display: "block",
                  borderRadius: "8px",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: "240px",
                height: "240px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.2)",
                padding: "16px",
                textAlign: "center",
              }}
            >
              <RefreshCw size={24} className="animate-spin" />
              <span style={{ fontSize: "12px", opacity: 0.9, lineHeight: "1.4" }}>
                {data.detail || "Generating WhatsApp QR code…"}
              </span>
              <button
                type="button"
                onClick={() => fetchStatus(true)}
                disabled={loading}
                style={{
                  marginTop: "6px",
                  padding: "5px 12px",
                  fontSize: "11px",
                  borderRadius: "6px",
                  background: "var(--green, #25d366)",
                  color: "#000",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Instant Reload QR
              </button>
            </div>
          )}

          {/* Instructions */}
          <div style={{ width: "100%", maxWidth: "380px", fontSize: "13px", lineHeight: "1.6" }}>
            <div style={{ fontWeight: 600, marginBottom: "6px", color: "#10b981" }}>
              How to pair your phone:
            </div>
            <ol style={{ paddingLeft: "20px", margin: 0, opacity: 0.9 }}>
              <li>Open <strong>WhatsApp</strong> on your phone</li>
              <li>Tap <strong>Settings</strong> (iOS) or <strong>⋮ Menu</strong> (Android)</li>
              <li>Select <strong>Linked Devices</strong> &rarr; <strong>Link a Device</strong></li>
              <li>Point your phone camera at this QR code to scan</li>
            </ol>
          </div>

          <div
            style={{
              fontSize: "12px",
              opacity: 0.7,
              textAlign: "center",
              background: "rgba(255,255,255,0.04)",
              padding: "8px 14px",
              borderRadius: "8px",
              width: "100%",
            }}
          >
            🔒 Zero Meta API fees · No developer verification · Runs on your own WhatsApp number
          </div>
        </div>
      ) : (
        /* Connected view */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px",
              borderRadius: "10px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#10b981" }}>
              🚀 Test Demo Multi-Device Adapter is Ready!
            </div>
            <div style={{ fontSize: "13px", opacity: 0.85 }}>
              Your device is paired and authorized to send transactional updates, delivery alerts, and order confirmations without Meta Cloud API limits.
            </div>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
              <button
                onClick={handleDisconnect}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Disconnect Device
              </button>
              <button
                onClick={close}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
