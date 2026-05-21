import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { sendPushNotification } from "@/lib/web-push";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    const body = await request.json();
    const { title, body: notifBody, url } = body as {
      title?: string;
      body?: string;
      url?: string;
    };

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    // Get all players with push subscriptions
    const subscribedPlayers = await db
      .select({
        id: players.id,
        name: players.name,
        pushSubscription: players.pushSubscription,
      })
      .from(players)
      .where(isNotNull(players.pushSubscription));

    let sent = 0;
    let errors = 0;

    for (const player of subscribedPlayers) {
      if (!player.pushSubscription) continue;

      const result = await sendPushNotification(
        player.pushSubscription,
        title,
        notifBody,
        url
      );

      if (result.success) {
        sent++;
      } else {
        errors++;
        console.warn(
          `[Push Send] Failed for ${player.name}: ${result.error}`
        );
      }
    }

    return NextResponse.json({
      sent,
      errors,
      totalSubscribed: subscribedPlayers.length,
    });
  } catch (err) {
    console.error("[Push Send]", err);
    return NextResponse.json(
      { error: "Failed to send push notifications" },
      { status: 500 }
    );
  }
}
