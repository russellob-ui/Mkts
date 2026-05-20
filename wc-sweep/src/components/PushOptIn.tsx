"use client";

import { useState, useEffect } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PUSH_OPTED_KEY = "wc_push_opted";
const PUSH_PLAYER_KEY = "wc_push_player_id";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushOptInProps {
  playerId?: number;
}

export default function PushOptIn({ playerId }: PushOptInProps) {
  const [status, setStatus] = useState<"idle" | "subscribed" | "denied" | "unsupported" | "loading">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    const opted = localStorage.getItem(PUSH_OPTED_KEY);
    if (opted === "true") {
      setStatus("subscribed");
      return;
    }

    setStatus("idle");
  }, []);

  async function handleSubscribe() {
    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications not configured");
      return;
    }

    const resolvedPlayerId = playerId ?? parseInt(localStorage.getItem(PUSH_PLAYER_KEY) ?? "0", 10);
    if (!resolvedPlayerId) {
      setError("Please select your player first");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: resolvedPlayerId,
          subscription: subscription.toJSON(),
        }),
      });

      if (res.ok) {
        localStorage.setItem(PUSH_OPTED_KEY, "true");
        setStatus("subscribed");
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to subscribe");
        setStatus("idle");
      }
    } catch (err) {
      console.error("[PushOptIn]", err);
      setError("Failed to enable notifications");
      setStatus("idle");
    }
  }

  if (status === "unsupported" || status === "loading") {
    return null;
  }

  if (status === "subscribed") {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-center">
        <span className="text-sm text-green-400">Notifications enabled</span>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-3 text-center">
        <span className="text-sm text-cream/40">
          Notifications blocked. Enable them in your browser settings.
        </span>
      </div>
    );
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-3">
      <div className="text-center">
        <p className="text-sm text-cream/60">
          Get instant goal alerts and match reminders
        </p>
      </div>
      {error && (
        <div className="text-red-400 text-xs text-center">{error}</div>
      )}
      <button
        type="button"
        onClick={handleSubscribe}
        className="w-full bg-wc-gold text-dark font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-wc-gold/90 transition-colors cursor-pointer"
      >
        Enable Notifications
      </button>
    </div>
  );
}
