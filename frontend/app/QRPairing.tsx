'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw, Smartphone, QrCode, AlertCircle, ShieldCheck } from 'lucide-react';

type Connection = { id: string; project: string; name: string };

export default function QRPairing({
  connection,
  api,
  onConnected,
}: {
  connection: Connection;
  api: (path: string, method?: string, body?: any) => Promise<any>;
  onConnected: () => void;
}) {
  const [state, setState] = useState<any>({ status: 'PAIRING' });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const notified = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const base = `/api/v1/connections/${connection.id}`;
    const query = `?project=${connection.project}`;

    const poll = async () => {
      try {
        const data = await api(base + '/qr' + query);
        if (!active) return;
        setState(data);
        setError('');
        setLoading(false);
        if (data.status === 'CONNECTED') {
          if (!notified.current) {
            notified.current = true;
            onConnected();
          }
          return;
        }
        if (['FAILED', 'REVOKED', 'DISCONNECTED'].includes(data.status)) return;
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
      if (active) timer = setTimeout(poll, 2000);
    };

    setLoading(true);
    api(base + '/pair' + query, 'POST', { project: connection.project })
      .then(() => {
        if (active) poll();
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connection.id, connection.project, api, retry]);

  return (
    <div className="qr-pairing" style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
      {/* Status banner */}
      {state.status === 'CONNECTED' ? (
        <div style={{ background: '#edf8ef', border: '1px solid #c8e6d0', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#18865a' }}>
          <CheckCircle2 size={24} color="#18865a" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '13px', display: 'block', color: '#18865a' }}>WhatsApp linked successfully!</strong>
            <small style={{ fontSize: '11px', color: '#4a6f58' }}>You can now send Bulk Broadcasts and verification OTP codes directly from your connected WhatsApp account.</small>
          </div>
        </div>
      ) : (
        <div style={{ background: '#f4f8f5', border: '1px solid #e1ebe4', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#359964', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1d2b25' }}>
              {loading ? 'Initializing WhatsApp pairing session…' : 'Scan with WhatsApp Linked Devices'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setState({ status: 'PAIRING' }); setLoading(true); setRetry(v => v + 1); }}
            style={{ border: '1px solid #d5dfd9', background: '#fff', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#1d2b25' }}
          >
            <RefreshCw size={12} /> Refresh QR
          </button>
        </div>
      )}

      {/* Error alert if any */}
      {error && (
        <div role="alert" style={{ background: '#fff0ed', border: '1px solid #f1d3cb', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#a14f3d', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>{error}</div>
        </div>
      )}

      {/* QR Code display area */}
      {state.status !== 'CONNECTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#f9fbf9', border: '2px dashed #dbe6de', borderRadius: '14px', minHeight: '260px', width: '100%', boxSizing: 'border-box' }}>
          {state.qr && state.status === 'PAIRING' ? (
            <div style={{ textAlign: 'center' }}>
              <img
                alt="WhatsApp linking QR code. Scan from Linked Devices in WhatsApp."
                src={state.qr}
                width={240}
                height={240}
                style={{ display: 'block', margin: '0 auto', background: '#ffffff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}
              />
              <p style={{ fontSize: '11px', color: '#7a8780', marginTop: '12px', marginBottom: 0 }}>
                QR code updates automatically · Point your phone camera to pair
              </p>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#7a8780', padding: '30px 0' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '12px', margin: 0 }}>Requesting fresh QR code from WhatsApp Gateway…</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#7a8780', padding: '20px' }}>
              <QrCode size={36} color="#9aa49f" style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontSize: '12px', margin: '0 0 12px' }}>{state.error || 'Waiting for QR code generation…'}</p>
              <button
                type="button"
                onClick={() => { setState({ status: 'PAIRING' }); setLoading(true); setRetry(v => v + 1); }}
                style={{ padding: '8px 16px', fontSize: '12px', background: '#18865a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Retry Pairing
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step-by-step instructions */}
      <div style={{ background: '#ffffff', border: '1px solid #e7ece9', borderRadius: '10px', padding: '16px 18px', width: '100%', boxSizing: 'border-box' }}>
        <strong style={{ fontSize: '12px', color: '#1d2b25', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <Smartphone size={15} color="#18865a" /> How to pair from your phone:
        </strong>
        <ol style={{ fontSize: '12px', lineHeight: 1.8, color: '#516559', paddingLeft: '20px', margin: 0 }}>
          <li>Open <strong>WhatsApp</strong> on your mobile phone.</li>
          <li>Go to <strong>Settings</strong> (iOS) or <strong>⋮ More options</strong> (Android) → <strong>Linked devices</strong>.</li>
          <li>Tap <strong>Link a device</strong> and scan the QR code above.</li>
        </ol>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#88988e' }}>
        <ShieldCheck size={14} color="#18865a" style={{ flexShrink: 0 }} />
        <span>End-to-end encrypted session. Your credentials stay isolated within your workspace.</span>
      </div>
    </div>
  );
}
