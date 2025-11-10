import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_ANALYZE_WEBHOOK_URL || process.env.N8N_ANALYZE_WEBHOOK_URL;

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { place_id } = body;

    if (!place_id) {
      return NextResponse.json(
        { error: "place_id is required" },
        { status: 400 }
      );
    }

    // If no webhook URL configured, return error
    if (!N8N_WEBHOOK_URL) {
      console.error("N8N_ANALYZE_WEBHOOK_URL not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Forward to n8n webhook
    const webhookPayload = {
      place_id,
      user_id: user.id,
      source: "webapp:onboard/analytics",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error("n8n webhook error:", errorText);
        return NextResponse.json(
          { error: "Webhook failed" },
          { status: 502 }
        );
      }

      // Return 202 Accepted
      return NextResponse.json(
        { message: "Analysis started", place_id },
        { status: 202 }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: "Webhook timeout" },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}






