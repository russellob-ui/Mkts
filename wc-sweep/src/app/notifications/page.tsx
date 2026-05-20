"use client";

import { useState, useEffect, useCallback } from "react";
import PushOptIn from "@/components/PushOptIn";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
}

interface Preferences {
  emailDigest: boolean;
  pushGoals: boolean;
  pushMatchStart: boolean;
  pushDailyReminder: boolean;
}

interface PrefsData {
  email: string | null;
  phone: string | null;
  hasPushSubscription: boolean;
  preferences: Preferences;
}

const PREF_LABELS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: "emailDigest", label: "Email Digest (Daily)", description: "Morning email with yesterday's results and today's fixtures" },
  { key: "pushGoals", label: "Push: Goals (Instant)", description: "Real-time alerts when your teams score" },
  { key: "pushMatchStart", label: "Push: Match Start", description: "Reminder 5 minutes before your team kicks off" },
  { key: "pushDailyReminder", label: "Push: Daily Reminder", description: "Morning reminder to check predictions and quiz" },
];

export default function NotificationsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [prefsData, setPrefsData] = useState<PrefsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/admin/players");
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players ?? []);
        }
      } catch {
        // ignore
      }
    }
    loadPlayers();
  }, []);

  const loadPrefs = useCallback(async (playerId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications/preferences?playerId=${playerId}`);
      if (res.ok) {
        const data: PrefsData = await res.json();
        setPrefsData(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPlayerId) {
      loadPrefs(selectedPlayerId);
    }
  }, [selectedPlayerId, loadPrefs]);

  async function togglePref(key: keyof Preferences) {
    if (!selectedPlayerId || !prefsData) return;
    setSaving(true);

    const newValue = !prefsData.preferences[key];
    const newPrefs = { ...prefsData.preferences, [key]: newValue };

    // Optimistic update
    setPrefsData({ ...prefsData, preferences: newPrefs });

    try {
      await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          preferences: { [key]: newValue },
        }),
      });
    } catch {
      // Revert on error
      setPrefsData({
        ...prefsData,
        preferences: { ...prefsData.preferences, [key]: !newValue },
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendTestPush() {
    if (!selectedPlayerId) return;
    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Notification",
          body: "This is a test push notification from WC Sweep 2026!",
          url: "/notifications",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult(`Sent to ${data.sent} device(s)`);
      } else {
        setTestResult("Failed to send test notification");
      }
    } catch {
      setTestResult("Network error");
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl font-bold">
          <span className="text-wc-gold">Notification</span>{" "}
          <span className="text-cream">Settings</span>
        </h1>
        <p className="text-cream/60 text-sm">
          Choose how you want to stay updated
        </p>
      </div>

      {/* Player selector */}
      <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
        <label className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
          Select Player
        </label>
        <select
          value={selectedPlayerId ?? ""}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value, 10) : null;
            setSelectedPlayerId(val);
            setPrefsData(null);
          }}
          className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2.5 text-sm text-cream focus:outline-none focus:border-wc-gold cursor-pointer"
        >
          <option value="">Choose your name...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.avatarEmoji ?? ""} {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center text-cream/40 text-sm py-4">Loading preferences...</div>
      )}

      {selectedPlayerId && prefsData && !loading && (
        <>
          {/* Current contact info */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
            <h2 className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
              Contact Info
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-cream/40 text-xs mb-1">Email</div>
                <div className="text-cream truncate">
                  {prefsData.email ?? "Not set"}
                </div>
              </div>
              <div>
                <div className="text-cream/40 text-xs mb-1">Phone</div>
                <div className="text-cream">
                  {prefsData.phone ?? "Not set"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${prefsData.hasPushSubscription ? "bg-green-500" : "bg-cream/30"}`} />
              <span className="text-cream/60">
                Push notifications: {prefsData.hasPushSubscription ? "Enabled" : "Not set up"}
              </span>
            </div>
          </div>

          {/* Push opt-in if not subscribed */}
          {!prefsData.hasPushSubscription && (
            <PushOptIn playerId={selectedPlayerId} />
          )}

          {/* Preference toggles */}
          <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-4">
            <h2 className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
              Notification Preferences
            </h2>
            {PREF_LABELS.map(({ key, label, description }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-cream">{label}</div>
                  <div className="text-xs text-cream/40">{description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => togglePref(key)}
                  disabled={saving}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${
                    prefsData.preferences[key]
                      ? "bg-wc-gold"
                      : "bg-dark-border"
                  }`}
                  aria-label={`Toggle ${label}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      prefsData.preferences[key] ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Test notification */}
          {prefsData.hasPushSubscription && (
            <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-semibold text-cream/60 uppercase tracking-wider">
                Test
              </h2>
              <button
                type="button"
                onClick={sendTestPush}
                disabled={testSending}
                className="w-full bg-wc-blue text-cream font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-wc-blue/80 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {testSending ? "Sending..." : "Send Test Notification"}
              </button>
              {testResult && (
                <div className="text-xs text-center text-cream/60">
                  {testResult}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
