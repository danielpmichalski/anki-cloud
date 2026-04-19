// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import {useEffect, useState} from "react";
import type {ApiKey, NewApiKey, StorageConnection, SyncCredentials, User} from "./api";
import * as api from "./api";

// ── App ──────────────────────────────────────────────────────────────────────

type View = "loading" | "login" | "dashboard";

export default function App() {
    const [view, setView] = useState<View>("loading");
    const [user, setUser] = useState<User | null>(null);
    const [storage, setStorage] = useState<StorageConnection[]>([]);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [newKey, setNewKey] = useState<NewApiKey | null>(null);
    const [syncCreds, setSyncCreds] = useState<SyncCredentials | null>(null);
    const [notice, setNotice] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const storageParam = params.get("storage");
        if (storageParam === "connected") {
            setNotice({msg: "Google Drive connected successfully.", type: "success"});
            window.history.replaceState({}, "", "/");
        } else if (storageParam === "error") {
            setNotice({msg: "Failed to connect Google Drive. Please try again.", type: "error"});
            window.history.replaceState({}, "", "/");
        }
    }, []);

    useEffect(() => {
        api
            .getMe()
            .then((u) => {
                setUser(u);
                setView("dashboard");
            })
            .catch(() => setView("login"));
    }, []);

    const reloadDashboard = () =>
        Promise.all([api.getStorage(), api.getApiKeys(), api.getSyncPassword()]).then(([s, k, sc]) => {
            setStorage(s.connections);
            setApiKeys(k.apiKeys);
            setSyncCreds(sc);
        });

    useEffect(() => {
        if (view === "dashboard") reloadDashboard();
    }, [view]);

    if (view === "loading") {
        return <div className="loading-screen">Loading…</div>;
    }

    if (view === "login") {
        return <LoginPage/>;
    }

    return (
        <div>
            <Header user={user!}/>
            <main className="main">
                {notice && (
                    <Notice msg={notice.msg} type={notice.type} onClose={() => setNotice(null)}/>
                )}
                {newKey && <NewKeyBanner keyData={newKey} onDismiss={() => setNewKey(null)}/>}
                <StorageSection
                    connections={storage}
                    onDisconnect={async (provider) => {
                        await api.disconnectStorage(provider);
                        const s = await api.getStorage();
                        setStorage(s.connections);
                    }}
                />
                <SyncPasswordSection
                    creds={syncCreds}
                    onReset={async () => {
                        const sc = await api.resetSyncPassword();
                        setSyncCreds(sc);
                    }}
                />
                <ApiKeysSection
                    apiKeys={apiKeys}
                    onCreate={async (label) => {
                        const k = await api.createApiKey(label);
                        setNewKey(k);
                        const keys = await api.getApiKeys();
                        setApiKeys(keys.apiKeys);
                    }}
                    onRevoke={async (id) => {
                        await api.revokeApiKey(id);
                        const keys = await api.getApiKeys();
                        setApiKeys(keys.apiKeys);
                    }}
                />
            </main>
        </div>
    );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header({user}: { user: User }) {
    return (
        <header className="header">
            <span className="header-title">Account Settings</span>
            <div className="header-user">
                <span>{user.email ?? user.name ?? "Account"}</span>
                <a href="/v1/auth/logout" className="btn btn-sm btn-outline-light">
                    Sign out
                </a>
            </div>
        </header>
    );
}

// ── Login Page ───────────────────────────────────────────────────────────────

function LoginPage() {
    return (
        <div className="login-page">
            <div className="login-card">
                <h1 className="login-title">Account Settings</h1>
                <p className="login-subtitle">Sign in to manage your account</p>
                <a href="/v1/auth/google" className="btn-google">
                    <GoogleIcon/>
                    Continue with Google
                </a>
            </div>
        </div>
    );
}

// ── Notice ───────────────────────────────────────────────────────────────────

function Notice({
                    msg,
                    type,
                    onClose,
                }: {
    msg: string;
    type: "success" | "error";
    onClose: () => void;
}) {
    return (
        <div className={`notice notice-${type}`}>
            <span>{msg}</span>
            <button onClick={onClose} className="notice-close" aria-label="Dismiss">
                ×
            </button>
        </div>
    );
}

// ── New Key Banner ────────────────────────────────────────────────────────────

function NewKeyBanner({keyData, onDismiss}: { keyData: NewApiKey; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(keyData.key);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="new-key-banner">
            <div>
                <p className="new-key-heading">New API key — copy it now</p>
                <p className="new-key-warning">This key will not be shown again.</p>
            </div>
            <div className="new-key-body">
                <code className="key-value">{keyData.key}</code>
                <button onClick={copy} className="btn btn-primary btn-sm">
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
            <div className="new-key-footer">
                <span className="muted">Label: {keyData.label}</span>
                <button onClick={onDismiss} className="btn btn-outline btn-sm">
                    I&apos;ve saved this key
                </button>
            </div>
        </div>
    );
}

// ── Storage Section ───────────────────────────────────────────────────────────

function StorageSection({
                            connections,
                            onDisconnect,
                        }: {
    connections: StorageConnection[];
    onDisconnect: (provider: string) => Promise<void>;
}) {
    const [busy, setBusy] = useState(false);
    const gdrive = connections.find((c) => c.provider === "gdrive");

    const handleDisconnect = async () => {
        if (!confirm("Disconnect Google Drive? Your data in Drive will not be deleted.")) return;
        setBusy(true);
        try {
            await onDisconnect("gdrive");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card">
            <h2 className="card-title">Storage</h2>
            <div className="storage-row">
                <div>
                    <p className="storage-name">Google Drive</p>
                    {gdrive ? (
                        <p className="storage-status connected">
                            Connected · {gdrive.folderPath} · since{" "}
                            {new Date(gdrive.connectedAt).toLocaleDateString()}
                        </p>
                    ) : (
                        <p className="storage-status disconnected">Not connected</p>
                    )}
                </div>
                {gdrive ? (
                    <button className="btn btn-danger btn-sm" onClick={handleDisconnect} disabled={busy}>
                        {busy ? "Disconnecting…" : "Disconnect"}
                    </button>
                ) : (
                    <a href="/v1/me/storage/connect/gdrive" className="btn btn-primary btn-sm">
                        Connect
                    </a>
                )}
            </div>
        </section>
    );
}

// ── API Keys Section ──────────────────────────────────────────────────────────

function ApiKeysSection({
                            apiKeys,
                            onCreate,
                            onRevoke,
                        }: {
    apiKeys: ApiKey[];
    onCreate: (label: string) => Promise<void>;
    onRevoke: (id: string) => Promise<void>;
}) {
    const [label, setLabel] = useState("");
    const [creating, setCreating] = useState(false);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label.trim()) {
            setFormError("Label is required.");
            return;
        }
        setFormError(null);
        setCreating(true);
        try {
            await onCreate(label.trim());
            setLabel("");
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to create key.");
        } finally {
            setCreating(false);
        }
    };

    const handleRevoke = async (id: string, keyLabel: string) => {
        if (!confirm(`Revoke "${keyLabel}"? This cannot be undone.`)) return;
        setRevoking(id);
        try {
            await onRevoke(id);
        } finally {
            setRevoking(null);
        }
    };

    return (
        <section className="card">
            <h2 className="card-title">API Keys</h2>

            {apiKeys.length === 0 ? (
                <p className="muted" style={{marginBottom: "20px"}}>
                    No API keys yet.
                </p>
            ) : (
                <table className="key-table">
                    <thead>
                    <tr>
                        <th>Label</th>
                        <th>Created</th>
                        <th>Last used</th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    {apiKeys.map((k) => (
                        <tr key={k.id}>
                            <td>{k.label}</td>
                            <td>{new Date(k.createdAt).toLocaleDateString()}</td>
                            <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "—"}</td>
                            <td className="text-right">
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleRevoke(k.id, k.label)}
                                    disabled={revoking === k.id}
                                >
                                    {revoking === k.id ? "Revoking…" : "Revoke"}
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}

            <form onSubmit={handleCreate} className="create-key-form">
                <p className="form-label">Generate new key</p>
                <div className="form-row">
                    <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Label (e.g. Claude Desktop)"
                        className="input"
                        maxLength={100}
                    />
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? "Generating…" : "Generate"}
                    </button>
                </div>
                {formError && <p className="form-error">{formError}</p>}
            </form>
        </section>
    );
}

// ── Sync Password Section ─────────────────────────────────────────────────────

function SyncPasswordSection({
                                 creds,
                                 onReset,
                             }: {
    creds: SyncCredentials | null;
    onReset: () => Promise<void>;
}) {
    const [copied, setCopied] = useState<"username" | "password" | null>(null);
    const [resetting, setResetting] = useState(false);
    const syncServerUrl = import.meta.env.VITE_SYNC_SERVER_URL ?? `http://${globalThis.location.hostname}:8080`;

    const copy = async (text: string, field: "username" | "password") => {
        await navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleReset = async () => {
        if (!confirm("Generate a new sync password? Your current password will stop working immediately."))
            return;
        setResetting(true);
        try {
            await onReset();
        } finally {
            setResetting(false);
        }
    };

    return (
        <section className="card">
            <h2 className="card-title">Anki Sync</h2>
            <p className="muted" style={{marginBottom: "16px"}}>
                <p>In Anki: <strong>Preferences → Syncing → Self-hosted sync server</strong>, set the URL to <code className="key-value" style={{display: "inline", padding: "2px 6px"}}>{syncServerUrl}</code>.</p>
                <p>Then under <strong>AnkiWeb Account</strong>, click <strong>Log In</strong> (or Log Out first, then Log In) and enter these credentials.</p>
            </p>

            <div className="form-row" style={{marginBottom: "12px"}}>
                <label className="form-label" style={{minWidth: "90px", margin: 0}}>Username</label>
                <code className="key-value" style={{flex: 1}}>{creds?.username ?? "—"}</code>
                {creds?.username && (
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => copy(creds.username!, "username")}
                    >
                        {copied === "username" ? "Copied!" : "Copy"}
                    </button>
                )}
            </div>

            <div className="form-row" style={{marginBottom: "16px"}}>
                <label className="form-label" style={{minWidth: "90px", margin: 0}}>Password</label>
                {creds?.password ? (
                    <>
                        <code className="key-value" style={{flex: 1}}>{creds.password}</code>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => copy(creds.password!, "password")}
                        >
                            {copied === "password" ? "Copied!" : "Copy"}
                        </button>
                    </>
                ) : (
                    <span className="muted" style={{flex: 1}}>••••••••••••  (set — not shown)</span>
                )}
            </div>

            {creds?.password && (
                <p className="new-key-warning" style={{marginBottom: "16px"}}>
                    Copy this password now — it will not be shown again.
                </p>
            )}

            <button className="btn btn-danger btn-sm" onClick={handleReset} disabled={resetting}>
                {resetting ? "Resetting…" : "Reset sync password"}
            </button>
        </section>
    );
}

// ── Google Icon ───────────────────────────────────────────────────────────────

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}
