'use client';
import QRPairing from './QRPairing';
import Modal from './Modal';
import WhatsAppWeb from './WhatsAppWeb';
import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import { ArrowUpRight, ArrowRight, Activity, Blocks, BookOpen, Check, ChevronDown, Code2, Contact, Copy, Globe, KeyRound, LayoutDashboard, LifeBuoy, LogOut, Mail, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings, ShieldCheck, Sparkles, Sun, Users, Webhook, Workflow, Zap, Menu, Trash2, GripVertical, Play, Clock, GitBranch } from 'lucide-react';

type Row=Record<string,any>;
type Field={name:string;label:string;type?:string;options?:{value:string;label:string}[];value?:string;required?:boolean};
const nav=[['Workspace',['Overview','Projects','Connections','API Keys']],['Build',['Send Message','Bulk Messaging','Inbox','Contacts','OTP Verification','Workflow Builder','Templates','Webhooks']],['Manage',['AI Assistant','Analytics','Usage & Billing','Team Members','Settings','Admin']],['Resources',['API Playground','API Documentation']]] as const;
const icons:Record<string,any>={'Overview':LayoutDashboard,'Projects':Blocks,'Connections':MessageCircle,'API Keys':KeyRound,'Send Message':Send,'Bulk Messaging':Users,'Inbox':Mail,'Contacts':Contact,'OTP Verification':ShieldCheck,'Workflow Builder':Workflow,'Templates':BookOpen,'Webhooks':Webhook,'AI Assistant':Sparkles,'Analytics':Activity,'Usage & Billing':Globe,'Team Members':Users,'Settings':Settings,'API Playground':Code2,'API Documentation':BookOpen,'Admin':ShieldCheck};
const descriptions:Record<string,string>={'Overview':'Your messaging infrastructure, at a glance.','Projects':'Separate your environments, credentials, and integrations.','Connections':'Connect a supported transport to your application.','API Keys':'Scoped access. Secrets shown once. Control that stays with you.','Send Message':'Send a message through your project transport.','Bulk Messaging':'Send broadcasts to multiple WhatsApp numbers with automated pacing.','Inbox':'Follow incoming messages and confirmed delivery events.','Contacts':'Keep recipient details and verifiable history.','OTP Verification':'Generate and verify 6-digit WhatsApp OTP codes.','Workflow Builder':'Build an ordered automation. Publish a version when it is ready.','Webhooks':'Deliver signed events to your approved HTTPS endpoints.','Templates':'Save reusable template drafts. Manage provider approval in Meta WhatsApp Manager.','AI Assistant':'Draft, classify, and summarize with human review.','Analytics':'Real activity from your project.','Usage & Billing':'Track reservations and accepted sends against your organization limit.','Team Members':'Invite collaborators with the right level of access.','Settings':'Manage your account and project settings.','Admin':'Platform-wide controls for authorized administrators.','API Playground':'Try the API with your secure browser session.','API Documentation':'Everything you need to connect your application.'};
function Badge({children}:{children:React.ReactNode}){return <span className={'badge '+String(children).toLowerCase()}>{children}</span>}
function Form({fields,submit,label='Save',children}:{fields:Field[];submit:(data:Row)=>Promise<void>;label?:string;children?:React.ReactNode}){const [busy,setBusy]=useState(false);return <form style={{display:'flex',flexDirection:'column',width:'100%',gap:'16px'}} onSubmit={async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));setBusy(true);try{await submit(data)}finally{setBusy(false)}}}>{fields.map(f=><label className="field" key={f.name} style={{display:'flex',flexDirection:'column',width:'100%',gap:'7px',margin:0,fontSize:'12px',fontWeight:600,color:'var(--ink)'}}><span>{f.label}</span>{f.options?<select name={f.name} defaultValue={f.value} required={f.required!==false} style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:'8px',border:'1px solid #dfe6e1',fontSize:'13px',background:'var(--surface)',color:'var(--ink)'}}>{f.options.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</select>:f.type==='textarea'?<textarea name={f.name} defaultValue={f.value} required={f.required!==false} rows={4} style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:'8px',border:'1px solid #dfe6e1',fontSize:'13px',background:'var(--surface)',color:'var(--ink)'}}/>:<input name={f.name} type={f.type??'text'} defaultValue={f.value} required={f.required!==false} style={{width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:'8px',border:'1px solid #dfe6e1',fontSize:'13px',background:'var(--surface)',color:'var(--ink)'}}/>}</label>)}{children}<button className="primary" disabled={busy} style={{width:'100%',height:'42px',marginTop:'6px',justifyContent:'center',fontSize:'13px',fontWeight:600}}>{busy?'Working…':label}<ArrowRight size={15}/></button></form>}
const COUNTRIES = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+974', name: 'Qatar', flag: '🇶🇦' },
  { code: '+968', name: 'Oman', flag: '🇴🇲' },
  { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', name: 'Bahrain', flag: '🇧🇭' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+977', name: 'Nepal', flag: '🇳🇵' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+353', name: 'Ireland', flag: '🇮🇪' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' }
];

function Empty({text='No records yet. Create your first one to get started.'}:{text?:string}){return <div className="empty"><MessageCircle size={30}/><h3>A clean slate</h3><p>{text}</p></div>}
export default function Home(){
 const [user,setUser]=useState<Row|null>(null),[ready,setReady]=useState(false),[csrf,setCsrf]=useState(''),[page,setPage]=useState('Overview'),[projects,setProjects]=useState<Row[]>([]),[orgs,setOrgs]=useState<Row[]>([]),[project,setProject]=useState(''),[stats,setStats]=useState<Row>({}),[rows,setRows]=useState<Row[]>([]),[connections,setConnections]=useState<Row[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[result,setResult]=useState<any>(null),[modal,setModal]=useState(''),[selected,setSelected]=useState<Row|null>(null),[authMode,setAuthMode]=useState('login'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[syncing,setSyncing]=useState(false),[inboxView,setInboxView]=useState<'chat'|'table'>('chat'),[mobile,setMobile]=useState(false),[docLang,setDocLang]=useState('curl'),[adminTab,setAdminTab]=useState<'users'|'usage'|'projects'|'connections'|'overview'>('users'),[waOtpReset,setWaOtpReset]=useState(false),[waStep,setWaStep]=useState(1),[waChallenge,setWaChallenge]=useState(''),[waUid,setWaUid]=useState<any>(null),[createdKey,setCreatedKey]=useState<Row|null>(null),[selectedKey,setSelectedKey]=useState<Row|null>(null),[copiedText,setCopiedText]=useState(''),[testPhone,setTestPhone]=useState('+919567334117'),[testBody,setTestBody]=useState('Hello from WhatsBridge API! 👋'),[testKeyInput,setTestKeyInput]=useState(''),[testRunning,setTestRunning]=useState(false),[testResult,setTestResult]=useState<any>(null);
 const [regFirstName, setRegFirstName] = useState('');
 const [regLastName, setRegLastName] = useState('');
 const [regEmail, setRegEmail] = useState('');
 const [regPhone, setRegPhone] = useState('');
 const [regPassword, setRegPassword] = useState('');
 const [regConfirmPassword, setRegConfirmPassword] = useState('');
 const [regOrg, setRegOrg] = useState('');
 const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
 const [countrySearch, setCountrySearch] = useState('');
 const [showCountryDropdown, setShowCountryDropdown] = useState(false);
 const [createdVerifyUrl, setCreatedVerifyUrl] = useState('');
 const [createdVerifyToken, setCreatedVerifyToken] = useState('');
 const [authBusy, setAuthBusy] = useState(false);
 const rowsRef=useRef<Row[]>([]);
 useEffect(()=>{rowsRef.current=rows},[rows]);
 const copyText=(txt:string,label:string)=>{try{navigator.clipboard.writeText(txt)}catch(e){const el=document.createElement('textarea');el.value=txt;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);}setCopiedText(label);setTimeout(()=>setCopiedText(''),2500);};
 
 const parseResponse = async (r: Response) => {
   if (r.status === 204) return null;
   const text = await r.text();
   try {
     return JSON.parse(text);
   } catch {
     if (!r.ok) {
       if (text.includes('An error occurred') || r.status >= 502) {
         throw new Error('Backend service is waking up or temporarily unavailable. Please retry in a few seconds.');
       }
       const clean = text.replace(/<[^>]+>/g, '').trim().slice(0, 160);
       throw new Error(clean || `Server error (${r.status})`);
     }
     return { detail: text };
   }
 };

 const runApiTest=async(apiKeySecret:string,connectionId?:string)=>{setTestRunning(true);setTestResult(null);try{const conn=connectionId||connections.find(c=>c.status==='CONNECTED')?.id||connections[0]?.id;const res=await fetch('/api/v1/messages?project='+project,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKeySecret.trim(),'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({...(conn?{connection:conn}:{}),phone:testPhone,kind:'text',payload:{body:testBody}})});const data=await parseResponse(res);if(!res.ok)throw new Error(typeof data?.error?.details==='string'?data.error.details:JSON.stringify(data?.error?.details??data));setTestResult(data);setNotice('Test message successfully sent via API key!');await refresh(true);}catch(err:any){setTestResult({error:err.message});}finally{setTestRunning(false);}};
 const active=projects.find(p=>p.id===project);
 const api=useCallback(async(path:string,method='GET',body?:Row,extra:Row={})=>{const r=await fetch(path,{method,credentials:'include',headers:{'Content-Type':'application/json','X-CSRFToken':csrf,...extra},...(body?{body:JSON.stringify(body)}:{})});const data=await parseResponse(r);if(!r.ok)throw new Error(typeof data?.error?.details==='string'?data.error.details:JSON.stringify(data?.error?.details??data));return data},[csrf]);
 const act=async(fn:()=>Promise<void>)=>{setError('');try{await fn()}catch(e){setError((e as Error).message)}};
 const [experimentalOTP,setExperimentalOTP]=useState(false);
 const loadSession=async()=>{try{const r=await fetch('/api/auth/session',{credentials:'include'});const data=await parseResponse(r);if(data?.csrfToken)setCsrf(data.csrfToken);if(data?.features)setExperimentalOTP(Boolean(data.features?.experimental_qr_otp));if(data?.user)setUser(data.user);setReady(true);}catch(e){console.warn('loadSession error:',e);setReady(true);}};
 useEffect(()=>{loadSession().catch(()=>{setError('Cannot reach the backend. Check that the services are running.');setReady(true)})},[]);
 const refreshProjects=useCallback(async()=>{const [ps,os]=await Promise.all([api('/api/projects'),api('/api/organizations')]);setProjects(ps);setOrgs(os);setProject(old=>ps.some((p:Row)=>p.id===old)?old:ps[0]?.id??'')},[api]);
 useEffect(()=>{if(user)refreshProjects().catch(e=>setError(e.message))},[user,refreshProjects]);
 const refresh=useCallback(async(background=false)=>{
   if(!project)return;
   if(background || rowsRef.current.length > 0){
     setSyncing(true);
   }else{
     setBusy(true);
   }
   try{
     const query='?project='+project;
     const map:Record<string,string>={'Connections':'connections','API Keys':'keys','Inbox':'messages','Contacts':'contacts','Workflow Builder':'workflows','Webhooks':'webhooks','Templates':'templates'};
     
     // 1. Immediately fetch the current active page data so user sees records in milliseconds!
     const pageTask = (async () => {
       if(map[page]){
         const d = await api('/api/v1/'+map[page]+query);
         setRows(d.results || []);
         if(page === 'Connections'){
           setConnections(d.results || []);
         }
       }else if(page==='Team Members'){
         const d = await api('/api/team'+query);
         setRows(d || []);
       }else if(page==='Admin'){
         const d = await api('/api/platform');
         setResult(d);
       }else{
         setRows([]);
       }
     })();

     // 2. Fetch overview statistics ONLY on pages that actually render them
     const needsStats = ['Overview','Analytics','Usage & Billing'].includes(page);
     const statsTask = needsStats ? api('/api/overview'+query).then(s => setStats(s)).catch(()=>{}) : Promise.resolve();

     // 3. Fetch connections only if not already loaded or on screens that configure them
     const needsConn = connections.length === 0 || ['Overview','Workflow Builder','Send Message','API Keys'].includes(page);
     const connTask = (needsConn && page !== 'Connections') ? api('/api/v1/connections'+query).then(c => setConnections(c.results || [])).catch(()=>{}) : Promise.resolve();

     await Promise.all([pageTask, statsTask, connTask]);
   }finally{
     setBusy(false);
     setSyncing(false);
   }
 },[project,page,api,connections.length]);
 useEffect(()=>{setResult(null);setSearch('');refresh().catch(e=>setError(e.message))},[refresh]);
 useEffect(()=>{
   if(!project||!user)return;
   let stopped=false;
   let poll:ReturnType<typeof setInterval>|undefined;
   let wsActive = false;
   const fallback=()=>{
     if(!stopped&&!poll&&!wsActive){
       poll=setInterval(()=>{
         if(document.visibilityState==='visible')refresh(true).catch(()=>{});
       },10000);
     }
   };
   let socket:WebSocket|null=null;
   try{
     const isVercel=typeof window!=='undefined'&&window.location.hostname.endsWith('vercel.app');
     const wsHost=isVercel?'whatsbridge-backend.onrender.com':window.location.host;
     const wsProto=(typeof window!=='undefined'&&window.location.protocol==='https:')||wsHost.includes('render.com')?'wss:':'ws:';
     const wsUrl=`${wsProto}//${wsHost}/ws/projects/${project}?uid=${user.id||''}`;
     socket=new WebSocket(wsUrl);
     socket.onopen=()=>{
       wsActive=true;
       if(poll){ clearInterval(poll); poll=undefined; }
     };
     socket.onmessage=e=>{
       try{
         refresh(true).catch(()=>{});
       }catch(err){}
     };
     socket.onerror=()=>{ wsActive=false; fallback(); };
     socket.onclose=()=>{ wsActive=false; fallback(); };
   }catch(err){
     fallback();
   }
   // Gentle 15-second background sync to guarantee state consistency without overloading backend
   const bgPoll=setInterval(()=>{
     if(document.visibilityState==='visible')refresh(true).catch(()=>{});
   },15000);
   return()=>{
     stopped=true;
     if(poll)clearInterval(poll);
     clearInterval(bgPoll);
     if(socket)socket.close();
   };
 },[project,user,refresh]);
 const mutate=async(path:string,data:Row,method='POST')=>{await api(path+'?project='+project,method,{...data,project});setNotice('Saved successfully');setModal('');await refresh(true);};
 const fieldsForConnection:Field[]=[{name:'name',label:'Connection name',value:'My WhatsApp'},{name:'provider',label:'Provider',options:[{value:'baileys',label:'WhatsApp Web · QR code linking (Recommended)'},{value:'meta',label:'Official Meta Cloud API'}]}];
 const linkWhatsApp=()=>act(async()=>{
   if(!active)throw new Error('Select a project first');
   let target=active;
   if(active.sandbox){
     target=await api('/api/projects','POST',{organization:active.organization,name:(active.name||'Live')+' · WhatsApp QR',sandbox:false});
     await refreshProjects();
     setProject(target.id);
   }
   const connection=await api('/api/v1/connections?project='+target.id,'POST',{project:target.id,name:'My WhatsApp · experimental',provider:'baileys'});
   setSelected(connection);setModal('qr');
 });
 const connectionOptions=connections.filter(c=>c.status==='CONNECTED').map(c=>({value:c.id,label:c.name}));
 const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
 const urlParams=typeof window!=='undefined'?new URLSearchParams(window.location.search):new URLSearchParams();

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    const fullPhone = selectedCountry.code + regPhone.trim();
    setAuthBusy(true);
    try {
      const res = await api('/api/auth/register', 'POST', {
        first_name: regFirstName.trim(),
        last_name: regLastName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: fullPhone,
        password: regPassword,
        confirm_password: regConfirmPassword,
        organization: regOrg.trim() || (regFirstName.trim() ? `${regFirstName.trim()}'s Organization` : 'My organization')
      });
      setNotice(res.detail || 'Account created! Verification email sent via SMTP.');
      if (res.verify_url) {
        setCreatedVerifyUrl(res.verify_url);
        setCreatedVerifyToken(res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const code = String(formData.get('code') || '').trim();
    setAuthBusy(true);
    try {
      const r = await api('/api/auth/login', 'POST', { email, password, ...(code ? { code } : {}) });
      setNotice(r.detail || 'Signed in');
      if (r.user) {
        setUser(r.user);
        if (r.csrfToken) setCsrf(r.csrfToken);
      } else {
        await loadSession();
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or unverified email');
    } finally {
      setAuthBusy(false);
    }
  };

 if(!ready)return <div className="boot"><div className="logo-mark"><MessageCircle/></div><p>Starting WhatsBridge…</p></div>;
  if(!user)return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand"><span className="logo-mark"><MessageCircle/></span>WhatsBridge<span className="brand-dot">.</span></div>
        <div>
          <span className="eyebrow">BUILT FOR DEVELOPERS</span>
          <h1>Good conversations.<br/><em>Great infrastructure.</em></h1>
          <p>One place to build, test, and manage messaging.<br/>From your first sandbox message to official WhatsApp integrations.</p>
          <div className="auth-points">
            <span><Check size={16}/> Tenant-isolated projects</span>
            <span><Check size={16}/> Official Meta & WhatsApp Web transport</span>
            <span><Check size={16}/> SMTP email verification & OTP security</span>
          </div>
        </div>
        <small>YOUR CODE. YOUR CUSTOMERS. CONNECTED.</small>
      </section>
      <section className="auth-form">
        <div className="auth-box" style={{ maxWidth: authMode === 'register' ? '460px' : '380px' }}>
          <span className="eyebrow">WELCOME TO WHATSBRIDGE</span>
          <h2>{authMode==='register'?'Create your account':authMode==='forgot-password'?'Reset your password':'Welcome back'}</h2>
          <p className="muted" style={{ marginBottom: '16px' }}>
            {authMode==='register'?'Start building with verified email and WhatsApp phone.':authMode==='forgot-password'?'Choose email or WhatsApp OTP to restore access.':'Sign in to your developer workspace.'}
          </p>

          {error && <div role="alert" className="error">{error}</div>}
          {notice && <div role="status" className="notice">{notice}</div>}

          {urlParams.has('verify') && (
            <div style={{ marginBottom: '16px', padding: '12px', background: '#eef8f1', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#166534', fontWeight: 600 }}>Verify your account</p>
              <button className="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={()=>act(async()=>{const d=await api('/api/auth/verify-email','POST',{token:urlParams.get('verify')});setNotice(d.detail);history.replaceState({},'','/');})}>Confirm Email Verification</button>
            </div>
          )}

          {createdVerifyUrl && (
            <div style={{ marginBottom: '16px', padding: '14px', background: '#eef8f1', border: '1px solid #bbf7d0', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#166534', margin: '0 0 10px' }}>
                ✓ Verification link ready!
              </p>
              <button
                type="button"
                className="primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => act(async () => {
                  const d = await api('/api/auth/verify-email', 'POST', { token: createdVerifyToken });
                  setNotice(d.detail);
                  setCreatedVerifyUrl('');
                  setCreatedVerifyToken('');
                  setAuthMode('login');
                })}
              >
                Click to Verify & Sign In Now
              </button>
            </div>
          )}

          {authMode==='forgot-password'&& (
            <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
              <button type="button" className={!waOtpReset?'primary':''} onClick={()=>{setWaOtpReset(false);setWaStep(1)}} style={{padding:'7px 11px',fontSize:'11px'}}>Reset with Email</button>
              <button type="button" className={waOtpReset?'primary':''} onClick={()=>{setWaOtpReset(true);setWaStep(1)}} style={{padding:'7px 11px',fontSize:'11px'}}>Reset via WhatsApp OTP</button>
            </div>
          )}

          {urlParams.has('reset') ? (
            <Form fields={[{name:'password',label:'New password (12+ characters)',type:'password'}]} submit={d=>act(async()=>{const r=await api('/api/auth/reset-password','POST',{...d,token:urlParams.get('reset'),uid:urlParams.get('uid')});setNotice(r.detail);history.replaceState({},'','/');setAuthMode('login');})} label="Reset password"/>
          ) : authMode==='forgot-password'&&waOtpReset ? (
            waStep===1 ? (
              <Form fields={[{name:'phone',label:'WhatsApp Phone Number (e.g. +919567334117)',value:'+91'}]} label="Send WhatsApp OTP" submit={d=>act(async()=>{const r=await api('/api/auth/whatsapp-otp-send','POST',d);setWaChallenge(r.challenge_id);setWaUid(r.user_id);setWaStep(2);setNotice(r.detail);})}/>
            ) : (
              <Form fields={[{name:'code',label:'6-Digit WhatsApp Code'},{name:'password',label:'New Password (12+ characters)',type:'password'}]} label="Verify & Reset Password" submit={d=>act(async()=>{const r=await api('/api/auth/whatsapp-otp-verify','POST',{...d,challenge_id:waChallenge,user_id:waUid});setNotice(r.detail);await loadSession();})}/>
            )
          ) : authMode === 'register' ? (
            /* CREATE AN ACCOUNT (NAME, LAST NAME, EMAIL, PHONE WITH SEARCHABLE REGION, PASSWORD, CONFIRM PASSWORD) */
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label className="field" style={{ margin: 0, gap: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>First name *</span>
                  <input
                    type="text"
                    required
                    placeholder="John"
                    value={regFirstName}
                    onChange={e => setRegFirstName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                  />
                </label>
                <label className="field" style={{ margin: 0, gap: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Last name *</span>
                  <input
                    type="text"
                    required
                    placeholder="Doe"
                    value={regLastName}
                    onChange={e => setRegLastName(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                  />
                </label>
              </div>

              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Email address *</span>
                <input
                  type="email"
                  required
                  placeholder="developer@example.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>

              {/* Phone with Country/Region dropdown and live search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>WhatsApp Phone Number *</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    style={{
                      padding: '10px 10px',
                      borderRadius: '8px',
                      border: '1px solid #dfe6e1',
                      background: 'var(--surface)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    title="Select country/region"
                  >
                    <span>{selectedCountry.flag}</span>
                    <span style={{ fontWeight: 600 }}>{selectedCountry.code}</span>
                    <ChevronDown size={14} color="#64748b" />
                  </button>

                  <input
                    type="tel"
                    required
                    placeholder="9567334117"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ flex: 1, width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                  />
                </div>

                {showCountryDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '64px',
                    left: 0,
                    width: '290px',
                    maxHeight: '260px',
                    background: 'var(--surface, #ffffff)',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', background: 'var(--bg, #f8fafc)' }}>
                      <input
                        type="text"
                        placeholder="Search region or dial code..."
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '200px' }}>
                      {COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.includes(countrySearch)).map(c => (
                        <div
                          key={c.name + c.code}
                          onClick={() => {
                            setSelectedCountry(c);
                            setShowCountryDropdown(false);
                            setCountrySearch('');
                          }}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            borderBottom: '1px solid #f8fafc',
                            background: selectedCountry.name === c.name ? 'var(--pale, #eef8f1)' : 'transparent'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{c.flag}</span>
                            <span>{c.name}</span>
                          </span>
                          <span style={{ fontWeight: 600, color: '#008069', fontSize: '12px' }}>{c.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Organization name (optional)</span>
                <input
                  type="text"
                  placeholder="My Workspace"
                  value={regOrg}
                  onChange={e => setRegOrg(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>

              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Password (12+ characters) *</span>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>

              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Confirm password *</span>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={regConfirmPassword}
                  onChange={e => setRegConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${regConfirmPassword && regConfirmPassword !== regPassword ? '#ef4444' : '#dfe6e1'}`,
                    fontSize: '13px'
                  }}
                />
                {regConfirmPassword && regConfirmPassword !== regPassword && (
                  <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 500 }}>Passwords do not match</span>
                )}
              </label>

              <button
                type="submit"
                className="primary"
                disabled={authBusy || (Boolean(regConfirmPassword) && regConfirmPassword !== regPassword)}
                style={{
                  width: '100%',
                  height: '42px',
                  marginTop: '6px',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {authBusy ? 'Creating account & sending SMTP email…' : 'Create Account'}
                <ArrowRight size={15} style={{ marginLeft: '4px' }} />
              </button>
            </form>
          ) : (
            /* FAST LOGIN FORM */
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Email address *</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="developer@example.com"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>
              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Password *</span>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>
              <label className="field" style={{ margin: 0, gap: '5px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>Two-factor code (if enabled)</span>
                <input
                  name="code"
                  type="text"
                  placeholder="6-digit code"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dfe6e1', fontSize: '13px' }}
                />
              </label>

              <button
                type="submit"
                className="primary"
                disabled={authBusy}
                style={{
                  width: '100%',
                  height: '42px',
                  marginTop: '6px',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {authBusy ? 'Signing in…' : 'Sign in'}
                <ArrowRight size={15} style={{ marginLeft: '4px' }} />
              </button>
            </form>
          )}

          <div className="auth-links" style={{ marginTop: '16px' }}>
            <button onClick={() => { setAuthMode(authMode==='login'?'register':'login'); setError(''); setNotice(''); }}>
              {authMode==='login'?'Create an account':'Back to sign in'}
            </button>
            <button onClick={() => { setAuthMode('forgot-password'); setError(''); setNotice(''); }}>
              Forgot password?
            </button>
          </div>
          <p className="fine" style={{ marginTop: '14px' }}>
            Production uses authenticated SMTP email dispatch.
          </p>
        </div>
      </section>
    </div>
  );
 return (
  <>
  <div className="shell"><aside className={mobile?'sidebar open':'sidebar'}><a className="brand" href="#" onClick={()=>setPage('Overview')}><span className="logo-mark"><MessageCircle size={21}/></span>WhatsBridge<span className="brand-dot">.</span></a><div className="workspace"><span className="avatar">{(active?.name??'W').slice(0,1)}</span><div><strong>{active?.name??'Your workspace'}</strong><small>Production workspace</small></div><ChevronDown size={14}/></div><nav>{nav.map(([group,items])=><div className="nav-group" key={group}><span>{group}</span>{items.filter(n=>n!=='Admin'||(user?.is_staff||user?.is_superuser)).map(n=>{const Icon=icons[n];return <button key={n} className={page===n?'nav-item active':'nav-item'} onClick={()=>{if(page!==n){setRows([]);setBusy(true);}setPage(n);setMobile(false);setError('');}}><Icon size={17}/>{n}{n==='Connections'&&<small>{connections.filter(c=>c.status==='CONNECTED').length}</small>}</button>})}</div>)}</nav><div className="sidebar-bottom"><div className="help-card"><Zap size={18}/><strong>Built for production</strong><p>Connect your WhatsApp.<br/>Automate and send messages.</p><button onClick={()=>setPage('API Documentation')}>Read the quickstart <ArrowUpRight size={14}/></button></div><button className="profile" onClick={()=>setPage('Settings')}><span className="avatar">{user.email?.slice(0,1).toUpperCase()}</span><span><strong>{user.first_name||'Developer'}</strong><small>{user.email}</small></span><MoreHorizontal size={16}/></button></div></aside>
 <div className="main"><header className="topbar"><button className="mobile-menu" aria-label="Toggle navigation" onClick={()=>setMobile(!mobile)}><Menu/></button><div className="breadcrumb">Workspace <span>/</span><strong>{page}</strong></div><div className="top-actions"><span className="environment"><i/>Production Live</span><button aria-label="Toggle color theme" onClick={()=>document.documentElement.classList.toggle('dark')}><Sun size={18}/></button><button aria-label="Sign out" onClick={()=>act(async()=>{await api('/api/auth/logout','POST',{});await loadSession()})}><LogOut size={17}/></button></div></header>
 <main><div className="page-heading"><div><span className="eyebrow">{page==='Overview'?'YOUR WORKSPACE, CONNECTED':'WHATSBRIDGE CONSOLE'}</span><h1>{page==='Overview'?'Workspace overview':page}</h1><p>{descriptions[page]}</p></div><div className="heading-actions">{page==='Connections'&&<button className="primary" onClick={linkWhatsApp}>Link my WhatsApp · QR</button>}<select aria-label="Active project" value={project} onChange={e=>setProject(e.target.value)}><option value="">Select a project</option>{projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select>{!['Workflow Builder','Templates','Webhooks'].includes(page)&&<button className="primary" onClick={()=>setModal(page==='Projects'||!project?'project':page==='Connections'?'connection':page==='API Keys'?'key':page==='Contacts'?'contact':page==='Team Members'?'invite':'project')}><Plus size={16}/>{page==='Connections'?'Add connection':page==='API Keys'?'Create key':page==='Contacts'?'Add contact':page==='Team Members'?'Invite member':'New project'}</button>}</div></div>
 {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}{urlParams.has('invite')&&<button className="primary" onClick={()=>act(async()=>{await api('/api/auth/accept-invitation','POST',{token:urlParams.get('invite')});history.replaceState({},'','/');await refreshProjects();setNotice('Invitation accepted')})}>Accept team invitation</button>}
 {!project&&page!=='Projects'?<section className="card welcome"><h2>Make room for your first integration.</h2><p>Create a project to get scoped API keys, WhatsApp connections, and messaging tools.</p><button className="primary" onClick={()=>setModal('project')}>Create your first project <ArrowRight size={16}/></button></section>:<>
 {page==='Overview'&&<><section className="welcome"><div><span className="pill"><span/> PRODUCTION ENVIRONMENT</span><h2>From a few lines of code<br/>to a real conversation.</h2><p>Manage your official transport, link your WhatsApp, and monitor confirmed message events in real time.</p><button className="primary" onClick={()=>setPage('Send Message')}>Send a message <ArrowRight size={16}/></button><button className="text-button" onClick={()=>setPage('API Documentation')}>Explore the docs <ArrowUpRight size={15}/></button></div><div className="code-card"><div><span/><span/><span/><small>your-next-idea.ts</small></div><pre>{`// One request. A new conversation.
await whatsbridge.messages.create({
  phone: "+15551234567",
  kind: "text",
  payload: { body: "Hello, world" }
});`}</pre><footer><i /> Server-side integration · see API documentation</footer></div></section><div className="stat-grid">{[['Messages queued', stats.messages ?? 0, Send], ['Active connections', stats.connections ?? 0, MessageCircle], ['Contacts', stats.contacts ?? 0, Contact], ['Monthly limit', stats.subscription?.monthly_limit ?? 0, Activity]].map(([label, value, Icon]: any) => <div className="stat-card" key={label}><div><span>{label}</span><Icon size={17} /></div><strong>{Number(value).toLocaleString()}</strong><small>{label === 'Monthly limit' ? 'Organization-wide message reservations' : 'From your project records'}</small></div>)}</div><div className="overview-grid"><section className="card"><div className="section-heading"><div><h2>Your connections</h2><p>Messaging transports for this project</p></div><button className="text-button" onClick={() => setPage('Connections')}>View all <ArrowUpRight size={14} /></button></div>{connections.length ? connections.slice(0, 4).map(c => <div className="connection-row" key={c.id}><span className="connection-icon"><MessageCircle size={22} /></span><div style={{minWidth:0,flex:1}}><strong>{c.name}</strong><div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'3px'}}><small style={{fontFamily:'monospace',color:'var(--muted)'}}>{c.id}</small><button type="button" className="text-button" style={{padding:'2px 4px'}} title="Copy Connection ID" onClick={() => copyText(c.id, 'ov-conn-' + c.id)}>{copiedText === 'ov-conn-' + c.id ? <Check size={11} color="var(--green)"/> : <Copy size={11}/>}</button></div><small style={{display:'block',marginTop:'2px'}}>{c.provider === 'baileys' ? 'WhatsApp Web · QR code linking' : 'Meta WhatsApp Cloud API'}</small></div><Badge>{c.status}</Badge></div>) : <Empty text="Add a WhatsApp connection to start sending messages." />}<button className="dashed-button" onClick={() => setModal('connection')}><Plus size={16} /> Add a connection</button></section><section className="card"><div className="section-heading"><div><h2>Get your integration going</h2><p>Three steps from setup to send</p></div><span className="step-count">{[connections.length > 0, (stats.contacts ?? 0) > 0, (stats.messages ?? 0) > 0].filter(Boolean).length}/3</span></div>{[['Connect a transport', 'Choose WhatsApp QR or official Meta.', 'Connections', connections.length > 0], ['Add a consenting contact', 'Record permission before sending.', 'Contacts', (stats.contacts ?? 0) > 0], ['Send your first message', 'Try your integration end to end.', 'Send Message', (stats.messages ?? 0) > 0]].map(([title, desc, target, done], i) => <button className="checklist" key={String(title)} onClick={() => setPage(String(target))}><span className={done ? 'step done' : 'step'}>{done ? <Check size={14} /> : i + 1}</span><span><strong>{title}</strong><small>{desc}</small></span><ArrowRight size={16} /></button>)}</section></div><section className="resource-banner"><div><Code2 size={23} /><span><strong>Designed for the way you build.</strong><small>REST API, signed webhooks, and integration examples in your stack.</small></span></div><button onClick={() => setPage('API Documentation')}>Open developer docs <ArrowUpRight size={16} /></button></section></>}
              {page === 'Projects' && (
                <div className="project-grid">
                  {projects.map(p => (
                    <div className="card project-card" key={p.id} style={{display:'flex',flexDirection:'column',justifyContent:'space-between',textAlign:'left'}}>
                      <div onClick={() => { setProject(p.id); setPage('Overview') }} style={{cursor:'pointer',width:'100%'}}>
                        <Blocks />
                        <h2>{p.name}</h2>
                        <Badge>Production</Badge>
                        <code>{p.id}</code>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',marginTop:'14px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
                        <button className="text-button" style={{padding:0,fontSize:'13px'}} onClick={() => { setProject(p.id); setPage('Overview') }}>
                          Open project <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          style={{color:'var(--red, #ef4444)',padding:'4px 8px',fontSize:'12px',display:'inline-flex',alignItems:'center',gap:'4px'}}
                          title="Delete this project"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (projects.length <= 1) {
                              alert('Cannot delete the last remaining project in your organization.');
                              return;
                            }
                            if (confirm(`Are you sure you want to permanently delete project "${p.name}"? This action will remove all its connections, API keys, and message history.`)) {
                              act(async () => {
                                await api('/api/projects?project=' + p.id, 'DELETE', {});
                                await refreshProjects();
                                setNotice(`Project "${p.name}" deleted successfully.`);
                              });
                            }
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="card project-card" onClick={() => setModal('organization')}><Plus /><h2>New organization</h2><p>Create a separate workspace and team.</p></button>
                </div>
              )}
              {page === 'Inbox' && (
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',background:'var(--surface)',padding:'10px 16px',borderRadius:'10px',border:'1px solid var(--line)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <span style={{fontSize:'12px',fontWeight:700,color:'var(--muted)',letterSpacing:'0.5px'}}>INBOX VIEW:</span>
                    <div style={{display:'inline-flex',background:'var(--bg)',border:'1px solid var(--line)',borderRadius:'8px',padding:'3px',gap:'4px'}}>
                      <button
                        type="button"
                        className={inboxView === 'chat' ? 'primary' : 'text-button'}
                        style={{padding:'6px 14px',fontSize:'12px',borderRadius:'6px'}}
                        onClick={() => setInboxView('chat')}
                      >
                        <MessageCircle size={14} style={{marginRight:'5px'}} /> WhatsApp Web
                      </button>
                      <button
                        type="button"
                        className={inboxView === 'table' ? 'primary' : 'text-button'}
                        style={{padding:'6px 14px',fontSize:'12px',borderRadius:'6px'}}
                        onClick={() => setInboxView('table')}
                      >
                        Audit Records Table
                      </button>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    {syncing && (
                      <span style={{fontSize:'11px',display:'inline-flex',alignItems:'center',gap:'5px',background:'var(--pale)',color:'var(--green)',padding:'4px 10px',borderRadius:'12px',fontWeight:600}}>
                        <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--green)',display:'inline-block',animation:'pulse 1s infinite'}}/>
                        Live streaming
                      </span>
                    )}
                    <span style={{fontSize:'12px',color:'var(--muted)'}}>
                      {connections.find(c => c.status === 'CONNECTED') ? `🟢 ${connections.find(c => c.status === 'CONNECTED')?.name}` : 'Transport disconnected'}
                    </span>
                  </div>
                </div>
              )}
              {page === 'Inbox' && inboxView === 'chat' ? (
                <WhatsAppWeb
                  messages={rows}
                  connections={connections}
                  project={project}
                  api={api}
                  refresh={refresh}
                  copyText={copyText}
                  copiedText={copiedText}
                />
              ) : (
                ['Connections', 'API Keys', 'Inbox', 'Contacts', 'Team Members'].includes(page) && (
                  <section className="card">
                  {page === 'API Keys' && (
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--pale)',padding:'12px 18px',borderRadius:'10px',marginBottom:'16px',border:'1px solid var(--border)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <KeyRound size={20} color="var(--green)" />
                        <div>
                          <strong style={{fontSize:'13px'}}>Ready to integrate with your stack or AI agent?</strong>
                          <p className="muted" style={{fontSize:'12px',margin:0}}>
                            Every API key works directly with cURL, Python, Node.js, and WhatsApp dispatch.
                          </p>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button className="text-button" onClick={() => setPage('API Documentation')} style={{fontSize:'12px'}}>
                          Code Snippets <ArrowRight size={13} />
                        </button>
                        <button className="primary" onClick={() => { setTestKeyInput(''); setTestResult(null); setModal('test-key'); }} style={{fontSize:'12px',padding:'6px 14px'}}>
                          <Play size={13} /> Live Test API Key
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="table-tools">
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <h2>{page === 'Inbox' ? 'Conversation activity' : page}</h2>
                      {syncing && (
                        <span style={{fontSize:'10px',display:'inline-flex',alignItems:'center',gap:'5px',background:'var(--pale)',color:'var(--green)',padding:'2px 8px',borderRadius:'12px',fontWeight:600}}>
                          <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'var(--green)',display:'inline-block',animation:'pulse 1s infinite'}}/>
                          Live syncing
                        </span>
                      )}
                    </div>
                    <div className="search">
                      <Search size={16} />
                      <input aria-label="Search records" placeholder="Search records…" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                  </div>
                  {syncing && (
                    <div style={{height:'2px',width:'100%',background:'linear-gradient(90deg, #18865a, #4ade80, #18865a)',backgroundSize:'200% 100%',animation:'wb-shimmer 1.5s infinite linear',borderRadius:'2px',marginBottom:'12px'}}/>
                  )}
                  {busy && !rows.length ? (
                    <div className="table-skeleton">
                      <div className="skeleton-row" style={{height:'36px',opacity:0.6}}/>
                      <div className="skeleton-row"/>
                      <div className="skeleton-row" style={{opacity:0.85}}/>
                      <div className="skeleton-row" style={{opacity:0.7}}/>
                    </div>
                  ) : !filtered.length ? (
                    <Empty />
                  ) : (
                    <div className="table-scroll" style={{transition:'opacity .15s ease',opacity:syncing?0.85:1}}>
                      <table>
                        <thead>
                          <tr>
                            <th>{page === 'Inbox' ? 'Recipient' : 'Name'}</th>
                            <th>Details</th>
                            <th>Status / role</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(r => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.name || r.phone || r.user__email}</strong>
                                <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'4px'}}>
                                  <small style={{fontFamily:'monospace',color:'var(--muted)'}}>{r.id}</small>
                                  <button
                                    type="button"
                                    className="text-button"
                                    style={{padding:'2px 4px',display:'inline-flex',alignItems:'center'}}
                                    title={page === 'Connections' ? 'Copy Connection ID' : 'Copy ID'}
                                    onClick={() => copyText(r.id, 'col-id-' + r.id)}
                                  >
                                    {copiedText === 'col-id-' + r.id ? <Check size={11} color="var(--green)"/> : <Copy size={11}/>}
                                  </button>
                                </div>
                              </td>
                              <td>
                                {page === 'Connections' ? (
                                  <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                                    <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
                                      <code style={{fontSize:'11px'}}>{r.id}</code>
                                      <button
                                        type="button"
                                        className="text-button"
                                        style={{padding:'2px 4px'}}
                                        title="Copy Connection ID"
                                        onClick={() => copyText(r.id, 'det-conn-' + r.id)}
                                      >
                                        {copiedText === 'det-conn-' + r.id ? <Check size={12} color="var(--green)"/> : <Copy size={12}/>}
                                      </button>
                                    </span>
                                    <small style={{color:'var(--muted)'}}>{r.provider === 'baileys' ? 'WhatsApp Web QR' : 'Official Meta Cloud API'}</small>
                                  </div>
                                ) : page === 'API Keys' ? (
                                  <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                                    <span style={{display:'inline-flex',alignItems:'center',gap:'6px'}}>
                                      <code>{r.prefix}…</code>
                                      <button
                                        type="button"
                                        className="text-button"
                                        style={{padding:'2px 4px'}}
                                        title="Copy Key Prefix"
                                        onClick={() => copyText(r.prefix, 'pref-' + r.id)}
                                      >
                                        {copiedText === 'pref-' + r.id ? <Check size={12} color="var(--green)"/> : <Copy size={12}/>}
                                      </button>
                                    </span>
                                    <small style={{color:'var(--muted)'}}>Bearer Authentication</small>
                                  </div>
                                ) : (
                                  <>
                                    {r.language || r.provider || r.prefix || r.direction || r.phone || 'Team member'}
                                    {page === 'Inbox' && <small>{r.payload?.body || r.kind}</small>}
                                  </>
                                )}
                              </td>
                              <td>
                                <Badge>{r.status || r.role || (page === 'API Keys' ? (r.revoked_at ? 'revoked' : 'active') : page === 'Contacts' ? (r.consent?.[0]?.granted ? 'consent recorded' : 'no consent') : 'enabled')}</Badge>
                              </td>
                              <td>
                                <div className="row-actions">
                                  {page === 'Connections' && (
                                    <>
                                      <button
                                        type="button"
                                        title="Copy Connection ID"
                                        onClick={() => copyText(r.id, 'act-conn-' + r.id)}
                                      >
                                        {copiedText === 'act-conn-' + r.id ? <><Check size={11} color="var(--green)"/> Copied ID</> : <><Copy size={11}/> Copy ID</>}
                                      </button>
                                      {r.provider === 'baileys' && <button onClick={() => { setSelected(r); setModal('qr') }}>Show QR / status</button>}
                                      <button onClick={() => { setSelected(r); setModal('onboard') }} disabled={r.provider !== 'meta'}>Onboard</button>
                                      <button onClick={() => r.provider === 'baileys' && r.status !== 'CONNECTED' ? (setSelected(r), setModal('qr')) : act(() => mutate('/api/v1/connections/' + r.id + '/' + (r.status === 'CONNECTED' ? 'disconnect' : 'reconnect'), {}))}>
                                        {r.status === 'CONNECTED' ? 'Disconnect' : 'Reconnect'}
                                      </button>
                                      {r.status !== 'REVOKED' && (
                                        <button onClick={() => { if (confirm(`Revoke connection "${r.name}"? Credentials will be erased.`)) act(() => mutate('/api/v1/connections/' + r.id + '/revoke', {})); }}>
                                          Revoke
                                        </button>
                                      )}
                                      <button style={{color:'var(--red, #ef4444)'}} onClick={() => { if (confirm(`Permanently delete connection "${r.name}"?`)) act(() => mutate('/api/v1/connections/' + r.id + '?hard=true', {}, 'DELETE')); }}>
                                        Delete
                                      </button>
                                    </>
                                  )}
                                  {page === 'API Keys' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedKey(r);
                                          setTestKeyInput('');
                                          setTestResult(null);
                                          setModal('test-key');
                                        }}
                                      >
                                        <Play size={12} style={{marginRight:'3px'}} /> Test API
                                      </button>
                                      <button
                                        disabled={!!r.revoked_at}
                                        onClick={() => act(async () => {
                                          const res = await api('/api/v1/keys/' + r.id + '/rotate?project=' + project, 'POST', { project });
                                          await refresh();
                                          setCreatedKey(res);
                                          setModal('created-key');
                                        })}
                                      >
                                        Rotate
                                      </button>
                                      <button
                                        disabled={!!r.revoked_at}
                                        onClick={() => {
                                          if (confirm(`Revoke API key "${r.name}"? It will no longer authenticate requests.`)) {
                                            act(() => mutate('/api/v1/keys/' + r.id + '/revoke', {}));
                                          }
                                        }}
                                      >
                                        Revoke
                                      </button>
                                      <button
                                        style={{color:'var(--red, #ef4444)'}}
                                        onClick={() => {
                                          if (confirm(`Permanently delete API key "${r.name}"?`)) {
                                            act(() => mutate('/api/v1/keys/' + r.id + '?hard=true', {}, 'DELETE'));
                                          }
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                  {page === 'Contacts' && <button onClick={() => { setSelected(r); setModal('consent') }}>Consent</button>}
                                  {page === 'Team Members' && r.role !== 'owner' && <button onClick={() => act(() => mutate('/api/team', { membership: r.id }, 'DELETE'))}>Remove</button>}
                                  {page === 'Inbox' && <button onClick={() => setResult(r)}>Inspect</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="fine">Showing up to 50 records. The REST API supports pagination.</p>
                </section>
              ))}
              {page === 'Send Message' && <section className="card narrow"><h2>Create a message</h2><p className="muted">Send a text message directly through your connected WhatsApp or sandbox transport.</p><Form fields={[{ name: 'connection', label: 'Connection', options: connectionOptions }, { name: 'phone', label: 'Recipient · E.164', value: '+15551234567' }, { name: 'body', label: 'Message', type: 'textarea', value: 'Hello from WhatsBridge 👋' }]} label="Queue message" submit={d => act(async () => { const r = await api('/api/v1/messages?project=' + project, 'POST', { project, connection: d.connection, phone: d.phone, kind: 'text', payload: { body: d.body } }, { 'Idempotency-Key': crypto.randomUUID() }); setResult(r); setNotice('Message dispatched successfully! Check Inbox for delivery.'); await refresh() })} /><p className="fine">Use the API Playground for templates, media, and scheduled messages.</p></section>}
              {page === 'Bulk Messaging' && <section className="card narrow"><h2>Bulk Broadcast Messaging</h2><p className="muted">Broadcast WhatsApp messages to multiple recipients at once. Messages are automatically scheduled with a safe 5-second interval to avoid anti-spam limits.</p><Form fields={[{ name: 'connection', label: 'Connection', options: connectionOptions }, { name: 'phones', label: 'Recipient Numbers (one per line or comma-separated E.164, e.g. +15551234567)', type: 'textarea', value: '+15551234567\n+15559876543' }, { name: 'body', label: 'Message Body', type: 'textarea', value: 'Hello! This is a message from WhatsBridge.' }]} label="Dispatch Bulk Campaign" submit={d => act(async () => { const r = await api('/api/v1/messages/bulk?project=' + project, 'POST', { project, connection: d.connection, phones: d.phones, body: d.body }); setResult(r); setNotice(`Bulk campaign queued for ${r.total} recipient(s)!`); await refresh() })} /><p className="fine">Works directly with your linked WhatsApp account or official provider.</p></section>}
              {page === 'OTP Verification' && <div className="two-col"><section className="card"><h2>1. Create a challenge</h2><p className="muted">Generate and deliver a real 6-digit verification code directly to WhatsApp via your connected transport.</p><Form fields={[{ name: 'connection', label: 'Connection', options: connections.filter(c=>c.status==='CONNECTED').map(c=>({value:c.id,label:c.name + (c.provider==='baileys'?' · WhatsApp QR':c.provider==='meta'?' · Meta API':' · Sandbox')})) }, { name: 'phone', label: 'Phone number (e.g. +919567334117)', value: '+91' }, { name: 'template', label: 'Meta Template Name (only required for official Meta API; leave blank for WhatsApp QR)', required: false }]} label="Send OTP" submit={d => act(async () => { const r = await api('/api/v1/otp/send?project=' + project, 'POST', { ...d, project }); setResult(r); setNotice('Verification code dispatched to WhatsApp! Enter it below.'); })} /></section><section className="card"><h2>2. Verify the code</h2><Form key={result?.challenge_id} fields={[{ name: 'challenge_id', label: 'Challenge ID', value: result?.challenge_id }, { name: 'code', label: 'Six-digit code' }]} label="Verify code" submit={d => act(async () => { const r = await api('/api/v1/otp/verify?project=' + project, 'POST', { ...d, project }); setResult(r); setNotice('OTP verified successfully!'); })} /></section></div>}
              {['Workflow Builder', 'Templates', 'Webhooks'].includes(page) && (
                <section className="card narrow" style={{textAlign:'center',padding:'55px 28px',margin:'20px auto'}}>
                  <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'68px',height:'68px',borderRadius:'18px',background:'var(--pale)',color:'var(--green)',marginBottom:'22px'}}>
                    {page === 'Workflow Builder' ? <Workflow size={34} /> : page === 'Templates' ? <BookOpen size={34} /> : <Webhook size={34} />}
                  </div>
                  <div style={{display:'flex',justifyContent:'center',marginBottom:'12px'}}>
                    <span className="pill"><Clock size={13} /> COMING SOON</span>
                  </div>
                  <h2 style={{fontSize:'22px',marginBottom:'10px'}}>{page} is Coming Soon</h2>
                  <p className="muted" style={{maxWidth:'540px',margin:'10px auto 26px',fontSize:'13px',lineHeight:'1.8'}}>
                    {page === 'Workflow Builder'
                      ? 'Visual workflow automation is coming soon. In the meantime, you can automate all custom messaging workflows using your API key and the WhatsBridge REST API.'
                      : page === 'Templates'
                      ? 'Meta Cloud API message template drafting and syncing will launch in the next release. Your linked WhatsApp Web QR connection is active and can send plain-text and OTPs without templates.'
                      : 'Outbound webhook subscriptions and automated retry delivery are coming soon. Real-time delivery and message events are actively streaming in your console.'}
                  </p>
                  <div style={{display:'flex',justifyContent:'center',gap:'12px',flexWrap:'wrap'}}>
                    <button className="primary" onClick={() => setPage('Send Message')}>
                      <Send size={15} /> Send WhatsApp Message
                    </button>
                    <button onClick={() => setPage('API Documentation')}>
                      <BookOpen size={15} /> View API Documentation
                    </button>
                  </div>
                </section>
              )}
              {page === 'AI Assistant' && <section className="card narrow"><span className="pill"><Sparkles size={13} /> HUMAN REVIEW REQUIRED</span><h2>A thoughtful first draft</h2><p className="muted">Gemini must be configured by your platform administrator and enabled in project settings. Generated replies are suggestions.</p><Form fields={[{ name: 'mode', label: 'Task', options: ['reply', 'summary', 'intent', 'workflow'].map(v => ({ value: v, label: v })) }, { name: 'prompt', label: 'Customer question or conversation · English / Malayalam', type: 'textarea' }]} label="Generate suggestion" submit={d => act(async () => setResult(await api('/api/ai?project=' + project, 'POST', { ...d, project })))} /></section>}
              {['Analytics', 'Usage & Billing'].includes(page) && <div className="two-col"><section className="card"><h2>{page === 'Analytics' ? 'Message status' : 'Usage accounting'}</h2>{(page === 'Analytics' ? stats.by_status : stats.usage)?.map((r: Row) => <div className="usage-row" key={r.status || r.kind}><span>{r.status || r.kind}</span><strong>{r.count ?? r.quantity}</strong><div className="meter"><i style={{ width: `${Math.min(100, 100 * (r.count ?? r.quantity) / Math.max(stats.messages ?? 1, 1))}%` }} /></div></div>)}</section><section className="card"><h2>{stats.subscription?.plan ?? 'Sandbox'} plan</h2><p className="metric">{stats.subscription?.monthly_limit?.toLocaleString()}</p><p className="muted">Monthly organization-wide message reservations. Accepted sends are tracked separately. Payment collection is not connected.</p></section></div>}
              {page === 'Settings' && <div className="two-col"><section className="card"><h2>Your account</h2><Form fields={[{ name: 'first_name', label: 'Display name', value: user.first_name, required: false }]} submit={d => act(async () => { await api('/api/auth/profile', 'POST', d); await loadSession(); setNotice('Profile saved') })} /><hr /><h3>Two-factor authentication</h3><p className="muted">{user.totp_enabled ? 'Enabled' : 'Protect sign-in with an authenticator app.'}</p>{!user.totp_enabled && <><button onClick={() => act(async () => setResult(await api('/api/auth/2fa-setup', 'POST', {})))}>Generate authenticator secret</button><Form fields={[{ name: 'code', label: 'Authenticator code' }]} label="Enable two-factor" submit={d => act(async () => { await api('/api/auth/2fa-enable', 'POST', d); await loadSession() })} /></>}</section><section className="card"><h2>Project settings</h2><Form key={project} fields={[{ name: 'name', label: 'Project name', value: active?.name }, { name: 'ai_enabled', label: 'AI suggestions', value: String(active?.ai_enabled), options: [{ value: 'false', label: 'Disabled' }, { value: 'true', label: 'Enabled' }] }, { name: 'faq', label: 'Private FAQ knowledge base', type: 'textarea', value: active?.faq, required: false }]} submit={d => act(async () => { await api('/api/projects?project=' + project, 'PATCH', { ...d, ai_enabled: d.ai_enabled === 'true', project }); await refreshProjects(); setNotice('Settings saved') })} /><hr style={{margin:'20px 0'}}/><div style={{border:'1px solid rgba(239,68,68,0.25)',background:'rgba(239,68,68,0.03)',borderRadius:'8px',padding:'16px'}}><h3 style={{color:'var(--red, #ef4444)',margin:0,fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}><Trash2 size={15}/> Danger Zone</h3><p className="muted" style={{fontSize:'12px',margin:'6px 0 12px'}}>Permanently delete this project, along with all associated credentials, connections, API keys, and messages.</p><button type="button" style={{background:'var(--red, #ef4444)',color:'#fff',border:'none',padding:'8px 14px',borderRadius:'6px',fontSize:'12px',fontWeight:600,cursor:'pointer'}} onClick={()=>{if(projects.length<=1){alert('Cannot delete the last remaining project in your organization.');return;}if(confirm(`Are you sure you want to permanently delete project "${active?.name}"? This action cannot be undone.`)){act(async()=>{await api('/api/projects?project='+project,'DELETE',{});await refreshProjects();setPage('Overview');setNotice(`Project "${active?.name}" deleted.`);});}}}>Delete Project</button></div></section></div>}
              {page === 'Admin' && (
                <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                  <div className="stat-grid">
                    {[['Platform Users', result?.users_count ?? result?.users?.length ?? 0, Users],
                      ['Total Projects', result?.projects_count ?? result?.projects?.length ?? 0, Blocks],
                      ['Active Transports', result?.connections_count ?? result?.connections?.length ?? 0, MessageCircle],
                      ['Total Messages', result?.messages_total ?? result?.queue ?? 0, Send]].map(([label, value, Icon]: any) => (
                      <div className="stat-card" key={label}>
                        <div><span>{label}</span><Icon size={17} /></div>
                        <strong>{Number(value).toLocaleString()}</strong>
                        <small>Platform-wide administrator metric</small>
                      </div>
                    ))}
                  </div>

                  <div style={{display:'flex',gap:'8px',borderBottom:'1px solid var(--line)',paddingBottom:'10px',flexWrap:'wrap'}}>
                    {[
                      ['users','All Platform Users'],
                      ['usage','Platform Usage & Quotas'],
                      ['projects','All Projects'],
                      ['connections','All Transports'],
                      ['overview','Organization Controls']
                    ].map(([k,label])=>(
                      <button key={k} type="button" className={adminTab===k?'primary':''} onClick={()=>setAdminTab(k as any)} style={{padding:'7px 14px',fontSize:'12px'}}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {adminTab === 'users' && (
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>All Platform Users ({result?.users?.length ?? 0})</h2>
                          <p>Full administrator user controls: roles, verification, credentials, and full account management.</p>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>User / Email</th>
                              <th>Role & Access</th>
                              <th>Projects & Usage</th>
                              <th>Status</th>
                              <th>Joined</th>
                              <th>Admin Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(result?.users ?? []).map((u: Row) => (
                              <tr key={u.id}>
                                <td>
                                  <strong>{u.email}</strong>
                                  <small>ID: {u.id} · {u.first_name || 'No display name'}</small>
                                </td>
                                <td>
                                  <Badge>{u.is_superuser ? 'Super Administrator' : u.is_staff ? 'Staff Member' : 'Standard Developer'}</Badge>
                                </td>
                                <td>
                                  <strong>{u.projects_count ?? 0} projects</strong>
                                  <small>{(u.messages_count ?? 0).toLocaleString()} messages sent</small>
                                </td>
                                <td>
                                  <div style={{display:'flex',gap:'4px',flexDirection:'column'}}>
                                    <Badge>{u.email_verified ? 'Verified' : 'Unverified'}</Badge>
                                    <small style={{color: u.is_active ? 'var(--green)' : 'var(--red)'}}>{u.is_active ? 'Active' : 'Disabled'}</small>
                                  </div>
                                </td>
                                <td>
                                  <small>{new Date(u.date_joined).toLocaleDateString()}</small>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button type="button" onClick={() => act(async () => {
                                      const r = await api('/api/platform', 'POST', { action: 'toggle_staff', user_id: u.id });
                                      setNotice(r.detail);
                                      await refresh();
                                    })}>
                                      {u.is_staff ? 'Revoke Staff' : 'Make Super Admin'}
                                    </button>
                                    <button type="button" onClick={() => act(async () => {
                                      const r = await api('/api/platform', 'POST', { action: 'toggle_verify', user_id: u.id });
                                      setNotice(r.detail);
                                      await refresh();
                                    })}>
                                      {u.email_verified ? 'Unverify' : 'Mark Verified'}
                                    </button>
                                    <button type="button" onClick={() => act(async () => {
                                      const r = await api('/api/platform', 'POST', { action: 'toggle_active', user_id: u.id });
                                      setNotice(r.detail);
                                      await refresh();
                                    })}>
                                      {u.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button type="button" onClick={() => act(async () => {
                                      const r = await api('/api/platform', 'POST', { action: 'reset_user_password', user_id: u.id, password: 'Password123!@#' });
                                      setNotice(r.detail);
                                    })}>
                                      Reset PW
                                    </button>
                                    {String(user?.id) !== String(u.id) && (
                                      <button
                                        type="button"
                                        style={{color:'var(--red, #ef4444)'}}
                                        title="Delete User"
                                        onClick={() => {
                                          if (confirm(`Permanently delete user "${u.email}"? All their projects and data will be removed.`)) {
                                            act(async () => {
                                              const r = await api('/api/platform', 'POST', { action: 'delete_user', user_id: u.id });
                                              setNotice(r.detail);
                                              await refresh();
                                            });
                                          }
                                        }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {adminTab === 'usage' && (
                    <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                      <div className="stat-grid">
                        {[
                          ['Total Messages', result?.messages_total ?? 0, Send],
                          ['Queued in Pipeline', result?.queue ?? 0, Activity],
                          ['Failed / Rejected', result?.failures ?? 0, LifeBuoy],
                          ['Dead Letter Webhooks', result?.webhook_dead_letters ?? 0, Webhook]
                        ].map(([label, value, Icon]: any) => (
                          <div className="stat-card" key={label}>
                            <div><span>{label}</span><Icon size={17} /></div>
                            <strong>{Number(value).toLocaleString()}</strong>
                            <small>Global metric</small>
                          </div>
                        ))}
                      </div>

                      <div className="two-col">
                        <section className="card">
                          <h2>Message Delivery Statuses</h2>
                          <p className="muted">Live distribution of messages by lifecycle stage.</p>
                          {(result?.by_status ?? []).map((s: Row) => (
                            <div className="usage-row" key={s.status}>
                              <span>{s.status}</span>
                              <strong>{Number(s.count).toLocaleString()}</strong>
                              <div className="meter">
                                <i style={{ width: `${Math.min(100, 100 * s.count / Math.max(result?.messages_total || 1, 1))}%` }} />
                              </div>
                            </div>
                          ))}
                        </section>

                        <section className="card">
                          <h2>Message Formats (Kinds)</h2>
                          <p className="muted">Volume split between plain text, templates, and OTPs.</p>
                          {(result?.by_kind ?? []).map((k: Row) => (
                            <div className="usage-row" key={k.kind}>
                              <span>{k.kind}</span>
                              <strong>{Number(k.count).toLocaleString()}</strong>
                              <div className="meter">
                                <i style={{ width: `${Math.min(100, 100 * k.count / Math.max(result?.messages_total || 1, 1))}%` }} />
                              </div>
                            </div>
                          ))}
                        </section>
                      </div>

                      <section className="card">
                        <h2>Organization Quotas & Consumption</h2>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Organization Name</th>
                                <th>Monthly Quota Limit</th>
                                <th>Projects</th>
                                <th>Messages Sent</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(result?.organizations ?? []).map((org: Row) => (
                                <tr key={org.id}>
                                  <td><strong>{org.name}</strong><small>{org.id}</small></td>
                                  <td>{Number(org.monthly_limit).toLocaleString()} msg / mo</td>
                                  <td>{org.projects_count ?? 0} projects</td>
                                  <td><strong>{Number(org.messages_count ?? 0).toLocaleString()}</strong></td>
                                  <td><Badge>{org.suspended ? 'Suspended' : 'Active'}</Badge></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </div>
                  )}

                  {adminTab === 'projects' && (
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>All Platform Projects ({result?.projects?.length ?? 0})</h2>
                          <p>Every tenant project provisioned across the platform.</p>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Project Name</th>
                              <th>Organization</th>
                              <th>Environment</th>
                              <th>Created</th>
                              <th>Admin Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(result?.projects ?? []).map((p: Row) => (
                              <tr key={p.id}>
                                <td>
                                  <strong>{p.name}</strong>
                                  <small>{p.id}</small>
                                </td>
                                <td>{p['organization__name'] || 'Organization'}</td>
                                <td><Badge>Production</Badge></td>
                                <td><small>{new Date(p.created_at).toLocaleDateString()}</small></td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      style={{color:'var(--red, #ef4444)'}}
                                      onClick={() => {
                                        if (confirm(`Permanently delete project "${p.name}" (${p.id})? This will delete all its connections and keys.`)) {
                                          act(async () => {
                                            const r = await api('/api/platform', 'POST', { action: 'delete_project', project_id: p.id });
                                            setNotice(r.detail);
                                            await refresh();
                                            await refreshProjects();
                                          });
                                        }
                                      }}
                                    >
                                      Delete Project
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {adminTab === 'connections' && (
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>All WhatsApp & Gateway Connections ({result?.connections?.length ?? 0})</h2>
                          <p>Every linked QR phone and Meta Cloud API transport across all projects.</p>
                        </div>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Transport Name</th>
                              <th>Provider</th>
                              <th>Status</th>
                              <th>Project</th>
                              <th>Last Active</th>
                              <th>Admin Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(result?.connections ?? []).map((c: Row) => (
                              <tr key={c.id}>
                                <td>
                                  <strong>{c.name}</strong>
                                  <small>{c.id}</small>
                                </td>
                                <td>{c.provider === 'baileys' ? 'WhatsApp QR' : c.provider === 'meta' ? 'Meta Cloud API' : 'Sandbox'}</td>
                                <td><Badge>{c.status}</Badge></td>
                                <td>{c['project__name'] || 'Project'}</td>
                                <td><small>{c.last_connected_at ? new Date(c.last_connected_at).toLocaleString() : 'Never'}</small></td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      style={{color:'var(--red, #ef4444)'}}
                                      onClick={() => {
                                        if (confirm(`Permanently delete connection "${c.name}" (${c.id})?`)) {
                                          act(async () => {
                                            const r = await api('/api/platform', 'POST', { action: 'delete_connection', connection_id: c.id });
                                            setNotice(r.detail);
                                            await refresh();
                                          });
                                        }
                                      }}
                                    >
                                      Delete Connection
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                  {adminTab === 'overview' && (
                    <section className="card">
                      <div className="section-heading">
                        <div>
                          <h2>Organization & Quota Controls</h2>
                          <p>Suspend tenants or scale monthly message capacities across the platform.</p>
                        </div>
                        <a href="/admin/" target="_blank" rel="noreferrer" style={{fontSize:'12px',fontWeight:600}}>
                          Open Django administration ↗
                        </a>
                      </div>
                      <Form fields={[
                        { name: 'organization', label: 'Organization', options: (result?.organizations ?? []).map((o: Row) => ({ value: o.id, label: o.name })) },
                        { name: 'suspended', label: 'Access Status', options: [{ value: 'false', label: 'Active · Normal Access' }, { value: 'true', label: 'Suspended · Block API & Sending' }] },
                        { name: 'monthly_limit', label: 'Monthly Message Limit', type: 'number', value: '50000' }
                      ]} label="Update Organization Settings" submit={d => act(async () => {
                        await api('/api/platform', 'POST', { ...d, suspended: d.suspended === 'true', monthly_limit: Number(d.monthly_limit) });
                        await refresh();
                        setNotice('Organization settings updated successfully');
                      })} />
                    </section>
                  )}
                </div>
              )}
              {page === 'API Playground' && <section className="card"><h2>Session-authenticated request</h2><p className="muted">No API key is stored in the browser. Your backend integrations should use a scoped Bearer key.</p><Form fields={[{ name: 'method', label: 'Method', options: ['GET', 'POST'].map(v => ({ value: v, label: v })) }, { name: 'path', label: 'API path', value: '/api/v1/messages' }, { name: 'body', label: 'JSON request body', type: 'textarea', value: '{}' }]} label="Run request" submit={d => act(async () => { if (!d.path.startsWith('/api/v1/')) throw new Error('Use a /api/v1/ path'); setResult(await api(d.path + '?project=' + project, d.method, d.method === 'POST' ? { ...JSON.parse(d.body), project } : undefined, { 'Idempotency-Key': crypto.randomUUID() })) })} /></section>}
              {page === 'API Documentation' && (() => {
                const connId = connections.find(c => c.status === 'CONNECTED')?.id || (connections[0]?.id ?? 'YOUR_CONNECTION_ID');
                const baseUrl = 'https://whatsbridge-backend.onrender.com/api/v1';
                const langSnippets: Record<string, string> = {
                  curl: `# 1. Send Message via cURL\ncurl -X POST "${baseUrl}/messages" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: msg-$(date +%s)" \\\n  -d '{\n    "connection": "${connId}",\n    "phone": "+919567334117",\n    "kind": "text",\n    "payload": {"body": "Hello from WhatsBridge API!"}\n  }'\n\n# 2. Dispatch WhatsApp 6-digit OTP\ncurl -X POST "${baseUrl}/otp/send?project=${project}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "connection": "${connId}",\n    "phone": "+919567334117"\n  }'\n\n# 3. Verify WhatsApp OTP\ncurl -X POST "${baseUrl}/otp/verify?project=${project}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "challenge_id": "CHALLENGE_ID_FROM_STEP_2",\n    "code": "123456"\n  }'`,
                  python: `import uuid\nimport requests\n\nAPI_KEY = "YOUR_API_KEY"\nBASE_URL = "${baseUrl}"\nCONNECTION_ID = "${connId}"\n\ndef send_message(phone: str, text: str):\n    headers = {\n        "Authorization": f"Bearer {API_KEY}",\n        "Content-Type": "application/json",\n        "Idempotency-Key": str(uuid.uuid4())\n    }\n    payload = {\n        "connection": CONNECTION_ID,\n        "phone": phone,\n        "kind": "text",\n        "payload": {"body": text}\n    }\n    res = requests.post(f"{BASE_URL}/messages", json=payload, headers=headers)\n    res.raise_for_status()\n    return res.json()\n\nprint(send_message("+919567334117", "Hello from Python!"))`,
                  node: `import { randomUUID } from "node:crypto";\n\nconst API_KEY = "YOUR_API_KEY";\nconst BASE_URL = "${baseUrl}";\nconst CONNECTION_ID = "${connId}";\n\nasync function sendWhatsApp(phone: string, text: string) {\n  const response = await fetch(\`\${BASE_URL}/messages\`, {\n    method: "POST",\n    headers: {\n      "Authorization": \`Bearer \${API_KEY}\`,\n      "Content-Type": "application/json",\n      "Idempotency-Key": randomUUID(),\n    },\n    body: JSON.stringify({\n      connection: CONNECTION_ID,\n      phone,\n      kind: "text",\n      payload: { body: text }\n    }),\n  });\n  const data = await response.json();\n  console.log("Queued message:", data);\n  return data;\n}\n\nsendWhatsApp("+919567334117", "Hello from Node.js!");`,
                  django: `# services/whatsapp.py\nimport uuid\nimport requests\nfrom django.conf import settings\n\ndef send_whatsapp(phone, message_text):\n    headers = {\n        "Authorization": f"Bearer {settings.WHATSBRIDGE_API_KEY}",\n        "Content-Type": "application/json",\n        "Idempotency-Key": str(uuid.uuid4())\n    }\n    data = {\n        "connection": settings.WHATSBRIDGE_CONNECTION_ID,\n        "phone": phone,\n        "kind": "text",\n        "payload": {"body": message_text}\n    }\n    resp = requests.post(f"${baseUrl}/messages", json=data, headers=headers, timeout=15)\n    return resp.json()\n\n# tasks.py (Celery Worker)\nfrom celery import shared_task\nfrom .services.whatsapp import send_whatsapp\n\n@shared_task(bind=True, max_retries=3)\ndef send_order_confirmation(self, phone, order_number):\n    return send_whatsapp(phone, f"Your order #{order_number} has been confirmed!")`,
                  php: `<?php\nuse Illuminate\\Support\\Facades\\Http;\nuse Illuminate\\Support\\Str;\n\n$apiKey = 'YOUR_API_KEY';\n$baseUrl = '${baseUrl}';\n$connectionId = '${connId}';\n\n$response = Http::withToken($apiKey)\n    ->withHeaders(['Idempotency-Key' => (string) Str::uuid()])\n    ->post("{$baseUrl}/messages", [\n        'connection' => $connectionId,\n        'phone' => '+919567334117',\n        'kind' => 'text',\n        'payload' => ['body' => 'Hello from PHP / Laravel!']\n    ]);\n\nreturn $response->json();`,
                  java: `import java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\nimport java.util.UUID;\n\npublic class WhatsAppService {\n    private static final String API_KEY = "YOUR_API_KEY";\n    private static final String BASE_URL = "${baseUrl}";\n    private static final String CONNECTION_ID = "${connId}";\n\n    public static void sendMessage(String phone, String text) throws Exception {\n        HttpClient client = HttpClient.newHttpClient();\n        String body = String.format("""\n            {\n                "connection": "%s",\n                "phone": "%s",\n                "kind": "text",\n                "payload": {"body": "%s"}\n            }\n        """, CONNECTION_ID, phone, text);\n\n        HttpRequest request = HttpRequest.newBuilder()\n            .uri(URI.create(BASE_URL + "/messages"))\n            .header("Authorization", "Bearer " + API_KEY)\n            .header("Content-Type", "application/json")\n            .header("Idempotency-Key", UUID.randomUUID().toString())\n            .POST(HttpRequest.BodyPublishers.ofString(body))\n            .build();\n\n        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n        System.out.println(response.body());\n    }\n}`,
                  ai: `You are an AI Messaging Agent with access to WhatsApp via the WhatsBridge REST API.\n\nAPI Base URL: ${baseUrl}\nAuthorization Header: Bearer YOUR_API_KEY\nConnection ID: ${connId}\nProject ID: ${project}\n\nWHEN SENDING A WHATSAPP MESSAGE:\nSend an HTTP POST request to ${baseUrl}/messages with headers:\n{\n  "Authorization": "Bearer YOUR_API_KEY",\n  "Content-Type": "application/json",\n  "Idempotency-Key": "<unique UUID>"\n}\nBody:\n{\n  "connection": "${connId}",\n  "phone": "<E.164 phone number, e.g. +919567334117>",\n  "kind": "text",\n  "payload": {\n    "body": "<friendly personalized message>"\n  }\n}\n\nWHEN DISPATCHING AN OTP VERIFICATION:\nPOST to ${baseUrl}/otp/send?project=${project}\n{\n  "connection": "${connId}",\n  "phone": "<E.164 phone number>"\n}\nSave the returned challenge_id, and prompt the user to reply with the 6-digit code.`
                };
                return (
                  <section className="card docs">
                    <span className="eyebrow">DEVELOPER INTEGRATION GUIDE</span>
                    <h2>Connect WhatsBridge to Any Tech Stack or AI Agent</h2>
                    <p className="muted">Use your scoped API Key to automate WhatsApp messaging, bulk campaigns, OTP verification, and workflows.</p>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'18px'}}>
                      {[
                        ['curl','cURL / Bash'],
                        ['python','Python'],
                        ['node','Node.js / TS'],
                        ['django','Django / Celery'],
                        ['php','PHP / Laravel'],
                        ['java','Java / Spring'],
                        ['ai','AI Agent Prompt']
                      ].map(([id,name])=>(
                        <button key={id} onClick={()=>setDocLang(id)} className={docLang===id?'primary':''} style={{padding:'7px 14px',fontSize:'12px'}}>
                          {name}
                        </button>
                      ))}
                    </div>
                    <pre style={{borderRadius:'10px',fontSize:'12px',padding:'18px',background:'#1c2d25',color:'#cae8d5'}}>
                      {langSnippets[docLang]}
                    </pre>
                    <hr />
                    <h3>Safe Webhook Consumption (HMAC-SHA256)</h3>
                    <p>Verify <code>X-WhatsBridge-Signature</code> over <code>timestamp + "." + rawBody</code> using your webhook signing secret, enforce a 5-minute replay window, and respond with HTTP 200 after storing the event.</p>
                    <a className="primary" href="/api/docs" target="_blank" rel="noreferrer" style={{marginTop:'12px'}}>
                      Open Interactive OpenAPI Reference <ArrowUpRight size={15}/>
                    </a>
                  </section>
                );
              })()}
 {result&&page!=='Admin'&&<section className="card result"><div className="section-heading"><h2>{result.secret?'Copy this secret now · shown once':'Request result'}</h2><button onClick={()=>setResult(null)}>Close</button></div><pre>{JSON.stringify(result,null,2)}</pre></section>}
 </>}
 <footer className="footer"><span>WhatsBridge <span>·</span> Production Platform</span><span><i/> Production transport · provider rules apply</span></footer></main></div>
 </div>
 {modal&&<Modal onClose={()=>setModal('')} title={modal==='qr'?'Link your WhatsApp':modal==='key'?'Create an API key':modal==='created-key'?'API Key Created · Live & Ready':modal==='test-key'?'Live WhatsApp API Tester':modal==='onboard'?'Official Meta onboarding':modal==='consent'?'Record recipient consent':modal==='connection'?'Add connection':modal==='project'?'Create project':'Create '+modal} description={modal==='qr'?'Connect your phone by scanning the QR code below.':modal==='key'?'Generate a scoped API key linked to your WhatsApp transport.':modal==='created-key'?'Copy your secret key now. It is shown once and cannot be retrieved later.':modal==='test-key'?'Send a live test message using your Bearer API key.':modal==='connection'?'Choose a messaging transport for this project.':modal==='project'?'Set up an isolated environment for your application.':undefined}>
 {modal==='qr'&&(selected ? <QRPairing connection={selected as any} api={api} onConnected={()=>{setNotice('WhatsApp linked. You can now send consented text messages.');refresh().catch(e=>setError(e.message))}}/> : <div style={{padding:'40px 20px',textAlign:'center',color:'var(--muted)'}}>Preparing WhatsApp connection session…</div>)}
 {modal==='project'&&(()=>{const prodOrg=orgs.find(o=>o.organization__name==='WhatsBridge Production')||orgs[0];const orgOptions=orgs.length?orgs.map(o=>({value:o.organization_id,label:o.organization__name})):[{value:prodOrg?.organization_id||'',label:'WhatsBridge Production'}];return <Form fields={[{name:'name',label:'Project name',value:'WhatsApp Production'},{name:'organization',label:'Organization',options:orgOptions,value:prodOrg?.organization_id}]} label="Create Live Project" submit={d=>act(async()=>{const orgId=d.organization||prodOrg?.organization_id;await api('/api/projects','POST',{name:d.name,organization:orgId,sandbox:false});await refreshProjects();setModal('');setNotice(`Project "${d.name}" created successfully.`);})}/>})()}
 {modal==='organization'&&<Form fields={[{name:'name',label:'Organization name'}]} submit={d=>act(async()=>{await api('/api/organizations','POST',d);await refreshProjects();setModal('')})}/>}
 {modal==='connection'&&<Form fields={fieldsForConnection} label="Connect" submit={d=>act(async()=>{const c=await api('/api/v1/connections?project='+project,'POST',{...d,project});await refresh();if(c.provider==='baileys'){setSelected(c);setModal('qr');}else setModal('');})}/>}
 {modal==='key'&&(()=>{
  const connOpts = connections.length
    ? connections.map(c => ({
        value: c.id,
        label: `${c.name} (${c.status === 'CONNECTED' ? '🟢 Connected' : c.status})`
      }))
    : [{ value: '', label: 'Default (Auto-select active connection)' }];
  const defaultConn = connections.find(c => c.status === 'CONNECTED')?.id || connections[0]?.id || '';
  return (
    <Form
      fields={[
        { name: 'name', label: 'Key name', value: 'Production API Key' },
        {
          name: 'connection',
          label: 'Linked WhatsApp Connection',
          options: connOpts,
          value: defaultConn
        },
        {
          name: 'scopes',
          label: 'Permissions',
          options: [
            { value: 'messages:send,messages:read,connections:read,otp:send,otp:verify', label: 'Full Access · Send & Read Messages, Connections (Recommended)' },
            { value: 'messages:send,connections:read', label: 'Send Messages Only' },
            { value: 'messages:read,connections:read', label: 'Read-Only Access' }
          ]
        },
        {
          name: 'expires',
          label: 'Expiration',
          options: [
            { value: 'never', label: 'Never expires (Recommended)' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
            { value: '1y', label: '1 year' }
          ]
        }
      ]}
      label="Create Key"
      submit={d => act(async () => {
        let expires_at: string | undefined = undefined;
        if (d.expires === '30d') {
          const dt = new Date(); dt.setDate(dt.getDate() + 30); expires_at = dt.toISOString();
        } else if (d.expires === '90d') {
          const dt = new Date(); dt.setDate(dt.getDate() + 90); expires_at = dt.toISOString();
        } else if (d.expires === '1y') {
          const dt = new Date(); dt.setFullYear(dt.getFullYear() + 1); expires_at = dt.toISOString();
        }
        const body = {
          name: d.name,
          scopes: d.scopes.split(',').map((s: string) => s.trim()),
          ...(expires_at ? { expires_at } : {})
        };
        const r = await api('/api/v1/keys?project=' + project, 'POST', { ...body, project });
        await refresh();
        const linkedConn = connections.find(c => c.id === d.connection) || connections.find(c => c.status === 'CONNECTED') || connections[0];
        setCreatedKey({
          ...r,
          connection_id: linkedConn?.id || r.connection_id,
          connection_name: linkedConn?.name || r.connection_name,
        });
        setTestResult(null);
        setModal('created-key');
      })}
    />
  );
})()}
{modal==='created-key'&&createdKey&&(
  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
    <div style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'8px',padding:'12px 14px',display:'flex',alignItems:'center',gap:'10px'}}>
      <Check size={20} color="var(--green)" style={{flexShrink:0}}/>
      <div>
        <strong style={{color:'var(--text)',fontSize:'13px'}}>API key generated successfully!</strong>
        <p style={{margin:0,fontSize:'12px',color:'var(--muted)'}}>Copy your API key now. For your security, the secret cannot be displayed again after closing this window.</p>
      </div>
    </div>

    <div>
      <label style={{fontSize:'12px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'6px'}}>API SECRET KEY</label>
      <div style={{display:'flex',gap:'8px'}}>
        <input
          readOnly
          type="text"
          value={createdKey.secret || ''}
          style={{fontFamily:'monospace',fontSize:'13px',fontWeight:600,background:'var(--bg-muted,#18181b)',color:'var(--accent,#22c55e)',border:'1px solid var(--border)',borderRadius:'6px',padding:'10px 12px',flex:1}}
        />
        <button
          type="button"
          className="primary"
          style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'10px 16px',whiteSpace:'nowrap'}}
          onClick={() => copyText(createdKey.secret, 'secret-btn')}
        >
          {copiedText === 'secret-btn' ? <><Check size={16}/> Copied!</> : <><Copy size={16}/> Copy Key</>}
        </button>
      </div>
    </div>

    {createdKey.connection_id && (
      <div>
        <label style={{fontSize:'12px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'6px'}}>LINKED WHATSAPP CONNECTION</label>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <div style={{background:'var(--bg-muted,#18181b)',border:'1px solid var(--border)',borderRadius:'6px',padding:'8px 12px',flex:1,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:500}}>{createdKey.connection_name || 'Active WhatsApp Transport'}</span>
            <code style={{fontSize:'11px',color:'var(--muted)'}}>{createdKey.connection_id}</code>
          </div>
          <button
            type="button"
            style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'8px 12px',whiteSpace:'nowrap'}}
            onClick={() => copyText(createdKey.connection_id, 'conn-btn')}
          >
            {copiedText === 'conn-btn' ? <><Check size={14}/> Copied!</> : <><Copy size={14}/> Copy ID</>}
          </button>
        </div>
      </div>
    )}

    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:'8px',padding:'16px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <Play size={16} color="var(--accent,#22c55e)"/>
          <strong style={{fontSize:'14px'}}>Test Full API Dispatch Now</strong>
        </div>
        <span style={{fontSize:'11px',color:'var(--muted)'}}>Sends real live WhatsApp message</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
        <div>
          <label style={{fontSize:'11px',color:'var(--muted)',display:'block',marginBottom:'4px'}}>Recipient Phone (+country code)</label>
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="+919567334117"
            style={{width:'100%',padding:'8px 10px',borderRadius:'6px',border:'1px solid var(--border)',fontSize:'13px'}}
          />
        </div>
        <div>
          <label style={{fontSize:'11px',color:'var(--muted)',display:'block',marginBottom:'4px'}}>Message Text</label>
          <input
            type="text"
            value={testBody}
            onChange={e => setTestBody(e.target.value)}
            placeholder="Hello from WhatsBridge API!"
            style={{width:'100%',padding:'8px 10px',borderRadius:'6px',border:'1px solid var(--border)',fontSize:'13px'}}
          />
        </div>
      </div>

      <button
        type="button"
        className="primary"
        disabled={testRunning}
        style={{width:'100%',padding:'10px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
        onClick={() => runApiTest(createdKey.secret, createdKey.connection_id)}
      >
        <Send size={15}/> {testRunning ? 'Dispatching to WhatsApp...' : 'Send Test Message via API'}
      </button>

      {testResult && (
        <div style={{marginTop:'12px',padding:'10px 12px',borderRadius:'6px',fontSize:'12px',background:testResult.error?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',border:`1px solid ${testResult.error?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'}`,color:testResult.error?'var(--red,#ef4444)':'var(--green,#10b981)'}}>
          {testResult.error ? (
            <div><strong>Dispatch Error:</strong> {testResult.error}</div>
          ) : (
            <div>
              <strong>✓ API Success:</strong> Message queued successfully! ID: <code>{testResult.id || testResult.result?.id}</code> · Status: <code>{testResult.status || 'QUEUED'}</code>
            </div>
          )}
        </div>
      )}
    </div>

    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
        <label style={{fontSize:'12px',fontWeight:600,color:'var(--muted)'}}>cURL COMMAND</label>
        <button
          type="button"
          className="text-button"
          style={{fontSize:'12px'}}
          onClick={() => {
            const cmd = `curl -X POST https://whats-bridge.vercel.app/api/v1/messages?project=${project} \\\n  -H "Authorization: Bearer ${createdKey.secret}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phone": "${testPhone}", "kind": "text", "payload": {"body": "Hello from WhatsBridge API!"}${createdKey.connection_id ? `, "connection": "${createdKey.connection_id}"` : ''}}'`;
            copyText(cmd, 'curl-btn');
          }}
        >
          {copiedText === 'curl-btn' ? 'Copied!' : 'Copy cURL'}
        </button>
      </div>
      <pre style={{fontSize:'11px',padding:'10px',overflowX:'auto',borderRadius:'6px',background:'var(--bg-muted,#18181b)',color:'var(--text)',border:'1px solid var(--border)'}}>
{`curl -X POST https://whats-bridge.vercel.app/api/v1/messages?project=${project} \\
  -H "Authorization: Bearer ${createdKey.secret}" \\
  -H "Content-Type: application/json" \\
  -d '{"phone": "${testPhone}", "kind": "text", "payload": {"body": "Hello from WhatsBridge API!"}${createdKey.connection_id ? `, "connection": "${createdKey.connection_id}"` : ''}}'`}
      </pre>
    </div>

    <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'10px'}}>
      <button type="button" className="primary" onClick={() => { setCreatedKey(null); setModal(''); }}>
        I have copied my key · Done
      </button>
    </div>
  </div>
)}
{modal==='test-key'&&(
  <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
    <p style={{fontSize:'13px',color:'var(--muted)',margin:0}}>
      Test live WhatsApp message delivery using your API Key for project <strong>{active?.name || project}</strong>.
    </p>

    <div>
      <label style={{fontSize:'12px',fontWeight:600,color:'var(--muted)',display:'block',marginBottom:'6px'}}>API KEY SECRET</label>
      <input
        type="password"
        placeholder="wb_live_..."
        value={testKeyInput}
        onChange={e => setTestKeyInput(e.target.value)}
        style={{width:'100%',fontFamily:'monospace',fontSize:'13px',padding:'10px 12px',borderRadius:'6px',border:'1px solid var(--border)'}}
      />
      <small style={{color:'var(--muted)',fontSize:'11px',marginTop:'4px',display:'block'}}>
        Enter the secret key for prefix <code>{selectedKey?.prefix || 'wb_...'}</code>
      </small>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
      <div>
        <label style={{fontSize:'11px',color:'var(--muted)',display:'block',marginBottom:'4px'}}>Recipient Phone</label>
        <input
          type="tel"
          value={testPhone}
          onChange={e => setTestPhone(e.target.value)}
          placeholder="+919567334117"
          style={{width:'100%',padding:'8px 10px',borderRadius:'6px',border:'1px solid var(--border)',fontSize:'13px'}}
        />
      </div>
      <div>
        <label style={{fontSize:'11px',color:'var(--muted)',display:'block',marginBottom:'4px'}}>WhatsApp Connection</label>
        <select
          value={selectedKey?.connection_id || ''}
          onChange={e => setSelectedKey(prev => prev ? ({ ...prev, connection_id: e.target.value }) : null)}
          style={{width:'100%',padding:'8px 10px',borderRadius:'6px',border:'1px solid var(--border)',fontSize:'13px'}}
        >
          {connections.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
          ))}
          {connections.length === 0 && <option value="">Auto-select connected transport</option>}
        </select>
      </div>
    </div>

    <div>
      <label style={{fontSize:'11px',color:'var(--muted)',display:'block',marginBottom:'4px'}}>Message Body</label>
      <input
        type="text"
        value={testBody}
        onChange={e => setTestBody(e.target.value)}
        placeholder="Hello from WhatsBridge API!"
        style={{width:'100%',padding:'8px 10px',borderRadius:'6px',border:'1px solid var(--border)',fontSize:'13px'}}
      />
    </div>

    <button
      type="button"
      className="primary"
      disabled={testRunning || !testKeyInput.trim()}
      style={{padding:'10px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}
      onClick={() => runApiTest(testKeyInput, selectedKey?.connection_id)}
    >
      <Send size={15}/> {testRunning ? 'Sending...' : 'Send Live Test Message'}
    </button>

    {testResult && (
      <div style={{padding:'10px 12px',borderRadius:'6px',fontSize:'12px',background:testResult.error?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',border:`1px solid ${testResult.error?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'}`,color:testResult.error?'var(--red,#ef4444)':'var(--green,#10b981)'}}>
        {testResult.error ? (
          <div><strong>Test Failed:</strong> {testResult.error}</div>
        ) : (
          <div>
            <strong>✓ Message Dispatched:</strong> ID: <code>{testResult.id || testResult.result?.id}</code> · Status: <code>{testResult.status || 'QUEUED'}</code>
          </div>
        )}
      </div>
    )}

    <div style={{display:'flex',justifyContent:'flex-end'}}>
      <button type="button" onClick={() => setModal('')}>Close</button>
    </div>
  </div>
)}
 {modal==='template'&&<Form fields={[{name:'name',label:'Template name (lowercase and underscores)'},{name:'language',label:'Language',value:'en_US'},{name:'category',label:'Category',options:['utility','authentication','marketing'].map(v=>({value:v,label:v}))},{name:'components',label:'Meta components JSON',type:'textarea',value:'[]'}]} submit={d=>act(()=>mutate('/api/v1/templates',{...d,components:JSON.parse(d.components)}))}><p className="fine">Saved as a local draft. This does not submit to Meta or confer provider approval.</p></Form>}
 {modal==='contact'&&<Form fields={[{name:'name',label:'Contact name',value:'Customer'},{name:'phone',label:'Phone number (e.g. +919567334117)',value:'+91'}]} label="Add contact" submit={d=>act(()=>mutate('/api/v1/contacts',d))}/>}
 {modal==='consent'&&<Form fields={[{name:'purpose',label:'Purpose',options:[{value:'messaging',label:'Messaging'},{value:'otp',label:'Verification OTP'}]},{name:'granted',label:'Permission',options:[{value:'true',label:'Granted'},{value:'false',label:'Revoked'}]},{name:'basis',label:'Source / evidence of authorization',type:'textarea'}]} submit={d=>act(()=>mutate('/api/v1/contacts/'+selected?.id+'/consent',{...d,granted:d.granted==='true'}))}/>}
 {modal==='webhook'&&<Form fields={[{name:'url',label:'Approved HTTPS endpoint',type:'url'},{name:'events',label:'Events (comma-separated)',value:'message.sent,message.delivered,message.failed'}]} submit={d=>act(async()=>{const r=await api('/api/v1/webhooks?project='+project,'POST',{project,url:d.url,events:d.events.split(',').map((s:string)=>s.trim())});await refresh();setResult(r);setModal('')})}/>}
 {modal==='invite'&&<Form fields={[{name:'email',label:'Email',type:'email'},{name:'role',label:'Role',options:['developer','admin','viewer'].map(v=>({value:v,label:v}))}]} submit={d=>act(()=>mutate('/api/team',d))}/>}
 {modal==='onboard'&&<Form fields={[{name:'phone_number_id',label:'Meta phone number ID'},{name:'access_token',label:'System user access token',type:'password'},{name:'app_secret',label:'Meta app secret',type:'password'},{name:'verify_token',label:'Webhook verify token',type:'password'}]} submit={d=>act(()=>mutate('/api/v1/connections/'+selected?.id+'/onboard',d))}><p className="fine">Credentials are submitted over your connection and encrypted on the server. They are never returned by the API. Use HTTPS for live deployments.</p></Form>}
 </Modal>}
 </>
);
}
function WorkflowEditor({ rows, api, project, connections, act, refresh, setResult }: { rows: Row[]; api: (path: string, method?: string, body?: Row) => Promise<any>; project: string; connections: { value: string; label: string }[]; act: (fn: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; setResult: (r: any) => void }) {
  const [id, setId] = useState(''), [name, setName] = useState('Order confirmation'), [nodes, setNodes] = useState<Row[]>([{ type: 'trigger', event: 'manual' }, { type: 'end' }]), [drag, setDrag] = useState<number | null>(null), [phone, setPhone] = useState('');
  const types = ['trigger', 'send_message', 'wait', 'condition', 'http_request', 'webhook', 'ai_response', 'update_contact', 'notify_admin', 'end'];
  const save = async () => { const r = await api('/api/v1/workflows' + (id ? '/' + id : '') + '?project=' + project, id ? 'PATCH' : 'POST', { project, name, graph: nodes }); setId(r.id); await refresh(); return r.id };
  const change = (i: number, k: string, v: any) => setNodes(nodes.map((n, j) => j === i ? { ...n, [k]: v } : n));
  return <section className="workflow-layout"><aside className="card node-palette"><h3>Node library</h3><p className="muted">Add a step. Drag to reorder.</p>{types.map(type => <button key={type} onClick={() => setNodes([...nodes, { type, ...(type === 'wait' ? { seconds: 60 } : type === 'send_message' ? { connection: connections[0]?.value, payload: { body: 'Thanks for your order.' } } : type === 'condition' ? { field: 'consent', equals: true } : {}) }])}><Plus size={14} />{type.replaceAll('_', ' ')}</button>)}<hr /><h3>Saved workflows</h3>{rows.map(r => <button key={r.id} onClick={() => { setId(r.id); setName(r.name); setNodes(r.graph) }}>{r.name}<Badge>{r.status}</Badge></button>)}</aside><div className="card workflow-canvas"><div className="workflow-toolbar"><input aria-label="Workflow name" value={name} onChange={e => setName(e.target.value)} /><button onClick={() => act(async () => { setId(''); setName('New workflow'); setNodes([{ type: 'trigger' }, { type: 'end' }]) })}>New</button><button onClick={() => act(async () => { await save() })}>Save draft</button><button className="primary" onClick={() => act(async () => { const key = await save(); await api('/api/v1/workflows/' + key + '/publish?project=' + project, 'POST', { project }); await refresh() })}>Publish <ArrowUpRight size={14} /></button></div><div className="nodes">{nodes.map((n, i) => <div className="workflow-node" key={i} draggable onDragStart={() => setDrag(i)} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag === null) return; const a = [...nodes]; const [item] = a.splice(drag, 1); a.splice(i, 0, item); setNodes(a); setDrag(null) }}><div className="node-title"><GripVertical size={16} /><span className="node-number">{i + 1}</span><strong>{n.type.replaceAll('_', ' ')}</strong><button aria-label="Move step up" disabled={i === 0} onClick={() => { const a = [...nodes];[a[i - 1], a[i]] = [a[i], a[i - 1]]; setNodes(a) }}>↑</button><button aria-label="Remove step" onClick={() => setNodes(nodes.filter((_, j) => i !== j))}><Trash2 size={14} /></button></div>{n.type === 'trigger' && <select value={n.event ?? 'manual'} onChange={e => change(i, 'event', e.target.value)}><option value="manual">Manual / API trigger</option><option value="message.received">Incoming message</option></select>}{n.type === 'send_message' && <><select aria-label="Connection" value={n.connection ?? ''} onChange={e => change(i, 'connection', e.target.value)}><option value="">Select connection</option>{connections.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select><textarea aria-label="Message body" value={n.payload?.body ?? ''} onChange={e => change(i, 'payload', { body: e.target.value })} /></>}{n.type === 'wait' && <label className="field">Wait seconds<input type="number" min={0} max={604800} value={n.seconds ?? 60} onChange={e => change(i, 'seconds', Number(e.target.value))} /></label>}{n.type === 'condition' && <><input aria-label="Context field" value={n.field ?? ''} onChange={e => change(i, 'field', e.target.value)} /><input aria-label="Equals value" value={String(n.equals ?? '')} onChange={e => change(i, 'equals', e.target.value)} /><small>Stop this linear run if the context value does not match.</small></>}{['http_request', 'webhook'].includes(n.type) && <input aria-label="Approved HTTPS URL" placeholder="https://approved.example.com/event" value={n.url ?? ''} onChange={e => change(i, 'url', e.target.value)} />} {n.type === 'update_contact' && <input aria-label="New contact name" value={n.name ?? ''} onChange={e => change(i, 'name', e.target.value)} />}</div>)}</div><div className="workflow-run"><input aria-label="Workflow recipient" placeholder="Recipient +15551234567" value={phone} onChange={e => setPhone(e.target.value)} /><button onClick={() => act(async () => { const key = await save(); setResult(await api('/api/v1/workflows/' + key + '/run?project=' + project, 'POST', { project, test_mode: true, context: { phone } })) })}><Play size={14} /> Test draft</button><button disabled={!id} onClick={() => act(async () => setResult(await api('/api/v1/workflows/' + id + '/run?project=' + project, 'POST', { project, context: { phone } })))}>Run published</button><button disabled={!id} onClick={() => act(async () => { setResult(await api('/api/v1/workflows/' + id + '/history?project=' + project)) })}>Execution history</button><button disabled={!id} onClick={() => act(async () => { await api('/api/v1/workflows/' + id + '/pause?project=' + project, 'POST', { project }); await refresh() })}>Pause</button><button disabled={!id} onClick={() => act(async () => { await api('/api/v1/workflows/' + id + '/resume?project=' + project, 'POST', { project }); await refresh() })}>Resume</button></div><p className="fine">Test mode requires sandbox transport, skips waits and external HTTP calls. AI nodes still consume the configured AI budget. Notify Admin records an audit event. This editor supports ordered flows, not branching graphs.</p></div></section>
}
