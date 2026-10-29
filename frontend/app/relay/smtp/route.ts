import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, host, port, secure, user, pass, from, to, subject, text, html } = body;

    // Verify authentication secret (accepts RELAY_SECRET, DJANGO_SECRET_KEY, or built-in shared token)
    const expectedSecret = process.env.RELAY_SECRET || process.env.DJANGO_SECRET_KEY || 'whatsbridge-shared-relay-token-2026';
    if (token !== expectedSecret && token !== 'whatsbridge-shared-relay-token-2026') {
      return NextResponse.json({ error: 'Unauthorized relay request' }, { status: 401 });
    }

    if (!host || !user || !pass || !to) {
      return NextResponse.json({ error: 'Missing required SMTP parameters (host, user, pass, to)' }, { status: 400 });
    }

    const portNum = Number(port) || 587;
    const isSecure = Boolean(secure) || portNum === 465;

    const transporter = nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port: portNum,
      secure: isSecure,
      auth: {
        user: String(user).trim(),
        pass: String(pass).replace(/\s+/g, '').trim()
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000
    });

    const info = await transporter.sendMail({
      from: from || user,
      to,
      subject,
      text,
      html: html || undefined
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });
  } catch (err: any) {
    console.error('SMTP relay error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch email via relay' },
      { status: 500 }
    );
  }
}
