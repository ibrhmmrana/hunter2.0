import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { place_id, user_id, email } = body;

    // Validate place_id
    if (!place_id || typeof place_id !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid place_id' },
        { status: 400 }
      );
    }

    // Check for webhook URL
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_URL is not configured');
      return NextResponse.json(
        { ok: false, error: 'Server configuration error: N8N_WEBHOOK_URL not set' },
        { status: 500 }
      );
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          place_id,
          user_id: user_id || null,
          email: email || null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error');
        console.error('n8n webhook error:', response.status, text);
        return NextResponse.json(
          { ok: false, error: `Webhook failed: ${response.status} ${text}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { ok: false, error: 'Request timeout (5s)' },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error: any) {
    console.error('Ingest API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






