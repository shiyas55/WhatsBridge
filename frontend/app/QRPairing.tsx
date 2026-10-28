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
        setLoading(data.status === 'PAIRING' && !data.qr);
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

    return () => { active = false; clearTimeout(timer); };
  }, [connection.id, connection.project, api, retry]);

  const connected = state.status === 'CONNECTED';
  const failed = Boolean(error || state.error || ['FAILED', 'DISCONNECTED', 'REVOKED'].includes(state.status));
  const refreshQR = () => { setError(''); setState({ status: 'PAIRING' }); setLoading(true); setRetry(v => v + 1); };
  return (
    <div className="wb-qr">
      <div className={'wb-qr-status' + (failed ? ' is-error' : '')} role="status" aria-live="polite">
        {connected ? <CheckCircle2 size={18}/> : failed ? <AlertCircle size={18}/> : <Smartphone size={18}/>}
        <span>{connected ? 'WhatsApp connected' : failed ? 'Pairing needs attention' : state.qr ? 'Ready to scan' : 'Preparing your QR code…'}</span>
      </div>
      {!connected && <div className="wb-qr-code" aria-busy={loading}>
        {state.qr && state.status === 'PAIRING' && !failed ? <img src={state.qr} width={280} height={280} alt="WhatsApp linking QR code. Scan with WhatsApp Linked devices."/> :
          <div className="wb-qr-placeholder">{failed ? <QrCode size={40}/> : <RefreshCw size={32} className="wb-spin"/>}<p>{failed ? 'Refresh to start a new pairing attempt.' : 'Connecting to WhatsApp. This can take a moment.'}</p></div>}
      </div>}
      {failed && <p className="wb-qr-error" role="alert">{error || state.error || 'The pairing session ended. Please try again.'}</p>}
      {!connected && <div className="wb-qr-refresh"><small>QR codes refresh automatically while pairing.</small><button type="button" onClick={refreshQR} disabled={loading}><RefreshCw size={15}/>{loading ? 'Preparing…' : 'Refresh QR'}</button></div>}
      {connected ? <p className="wb-qr-success">Your phone is linked. You can now send consented text messages through your project API.</p> : <section className="wb-qr-steps">
        <h3>On your phone</h3><ol><li>Open <strong>WhatsApp</strong>.</li><li>Go to <strong>Settings</strong> or <strong>⋮</strong> → <strong>Linked devices</strong>.</li><li>Tap <strong>Link a device</strong> and scan this code.</li></ol>
      </section>}
      <p className="wb-qr-note"><ShieldCheck size={16}/><span>Experimental connection · Encrypted session storage.<br/>OTP requires an official Meta connection.</span></p>
    </div>
  );
}
