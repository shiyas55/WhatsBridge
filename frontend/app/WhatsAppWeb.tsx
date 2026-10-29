'use client';
import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { 
  Send, Search, Plus, Check, Copy, MessageCircle, Phone, 
  MoreVertical, Paperclip, Smile, ShieldCheck, ArrowLeft, RefreshCw,
  Smartphone, Monitor, Video, PhoneCall, Mic, Camera, CheckCheck
} from 'lucide-react';

type Row = Record<string, any>;

interface WhatsAppWebProps {
  messages: Row[];
  connections: Row[];
  project: string;
  api: (path: string, method?: string, body?: any, extra?: any) => Promise<any>;
  refresh: (background?: boolean) => Promise<void>;
  copyText: (txt: string, label: string) => void;
  copiedText: string;
}

export default function WhatsAppWeb({
  messages,
  connections,
  project,
  api,
  refresh,
  copyText,
  copiedText
}: WhatsAppWebProps) {
  const [selectedPhone, setSelectedPhone] = useState<string>('');
  const [search, setSearch] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [clockTime, setClockTime] = useState('9:41');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update mobile status bar clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  // Auto-select active connection
  useEffect(() => {
    if (!activeConnectionId && connections.length > 0) {
      const conn = connections.find(c => c.status === 'CONNECTED') || connections[0];
      if (conn) setActiveConnectionId(conn.id);
    }
  }, [connections, activeConnectionId]);

  // Group messages by phone number into conversation threads
  const conversations = useMemo(() => {
    const map: Record<string, { phone: string; name?: string; messages: Row[]; lastMessage: Row }> = {};
    for (const m of messages) {
      const phone = m.phone || 'Unknown';
      if (!map[phone]) {
        map[phone] = {
          phone,
          name: m.name || m.contact_name,
          messages: [],
          lastMessage: m
        };
      }
      map[phone].messages.push(m);
    }
    // Sort messages chronologically (oldest to newest)
    Object.values(map).forEach(c => {
      c.messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      c.lastMessage = c.messages[c.messages.length - 1];
    });
    // Sort conversations by last message timestamp (newest first)
    return Object.values(map).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages]);

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(
      c => c.phone.toLowerCase().includes(q) || (c.name && c.name.toLowerCase().includes(q)) ||
           (c.lastMessage?.payload?.body && String(c.lastMessage.payload.body).toLowerCase().includes(q))
    );
  }, [conversations, search]);

  // Automatically select the first conversation if none selected
  useEffect(() => {
    if (!selectedPhone && conversations.length > 0) {
      setSelectedPhone(conversations[0].phone);
    }
  }, [conversations, selectedPhone]);

  // Active conversation and its messages
  const activeConversation = useMemo(() => {
    return conversations.find(c => c.phone === selectedPhone) || (selectedPhone ? {
      phone: selectedPhone,
      name: '',
      messages: [],
      lastMessage: null as any
    } : null);
  }, [conversations, selectedPhone]);

  // Auto-scroll to bottom of chat on new message or chat switch
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages?.length, selectedPhone, viewMode]);

  // Send a message directly from the WhatsApp composer
  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text || !selectedPhone || sending) return;

    setSending(true);
    const connId = activeConnectionId || connections.find(c => c.status === 'CONNECTED')?.id || connections[0]?.id;

    try {
      await api(
        '/api/v1/messages?project=' + project,
        'POST',
        {
          project,
          ...(connId ? { connection: connId } : {}),
          phone: selectedPhone,
          kind: 'text',
          payload: { body: text }
        },
        { 'Idempotency-Key': crypto.randomUUID() }
      );
      setInputMessage('');
      await refresh(true);
    } catch (err: any) {
      alert('Send failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'TODAY';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'TODAY';
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeConn = connections.find(c => c.id === activeConnectionId) || connections.find(c => c.status === 'CONNECTED') || connections[0];

  return (
    <div className="wb-whatsapp-container" style={{
      display: 'flex',
      height: 'calc(100vh - 190px)',
      minHeight: '680px',
      background: '#ffffff',
      border: '1px solid var(--line, #e7ece9)',
      borderRadius: '14px',
      overflow: 'hidden',
      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.07)',
      position: 'relative'
    }}>
      {/* SCOPED STYLES TO PREVENT ANY TAILWIND PURGE OR PARSING ISSUES */}
      <style>{`
        .wb-wa-sidebar {
          width: 360px;
          min-width: 320px;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          flex-shrink: 0;
        }
        .wb-wa-sidebar-header {
          height: 64px;
          padding: 12px 16px;
          background: #f0f2f5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e2e8f0;
        }
        .wb-wa-chat-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: background .12s ease;
        }
        .wb-wa-chat-item:hover {
          background: #f8fafc;
        }
        .wb-wa-chat-item.active {
          background: #eef8f1 !important;
          border-left: 4px solid #00a884;
        }
        .wb-phone-frame {
          width: 375px;
          height: 680px;
          background: #000000;
          border-radius: 46px;
          border: 10px solid #1e293b;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.45), 0 0 0 2px #334155;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          margin: auto;
        }
        .wb-phone-notch {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 94px;
          height: 22px;
          background: #000000;
          border-radius: 20px;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
        }
        .wb-doodle-bg {
          background-color: #efeae2;
          background-image: 
            radial-gradient(#128c7e15 1px, transparent 1px),
            radial-gradient(#075e5410 1px, #efeae2 1px);
          background-size: 20px 20px;
          background-position: 0 0, 10px 10px;
        }
        .wb-bubble-in-tail::before {
          content: "";
          position: absolute;
          top: 0;
          left: -7px;
          width: 0;
          height: 0;
          border-top: 8px solid #ffffff;
          border-left: 8px solid transparent;
        }
        .wb-bubble-out-tail::before {
          content: "";
          position: absolute;
          top: 0;
          right: -7px;
          width: 0;
          height: 0;
          border-top: 8px solid #d9fdd3;
          border-right: 8px solid transparent;
        }
      `}</style>

      {/* ========================================================================= */}
      {/* LEFT SIDEBAR: CONVERSATION LIST (SIDE UI/UX FIX) */}
      {/* ========================================================================= */}
      <aside className="wb-wa-sidebar">
        {/* Profile / Toolbar Header */}
        <header className="wb-wa-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#008069',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <MessageCircle size={22} color="#ffffff" />
              <span style={{
                position: 'absolute',
                bottom: '1px',
                right: '1px',
                width: '10px',
                height: '10px',
                background: '#25d366',
                border: '2px solid #ffffff',
                borderRadius: '50%'
              }} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#111b21' }}>Chats</h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setShowNewChat(!showNewChat)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: showNewChat ? '#e2e8f0' : 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#54656f'
              }}
              title="Start New Chat"
            >
              <Plus size={19} />
            </button>
            <button
              type="button"
              onClick={() => refresh(true)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#54656f'
              }}
              title="Refresh Messages"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {/* Active Transport Status Pill */}
        <div style={{
          padding: '8px 14px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: activeConn?.status === 'CONNECTED' ? '#25d366' : '#94a3b8',
              flexShrink: 0
            }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#334155',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {activeConn ? `${activeConn.name} (${activeConn.status})` : 'No Transport'}
            </span>
          </div>

          {activeConn?.id && (
            <button
              type="button"
              onClick={() => copyText(activeConn.id, 'sidebar-conn-' + activeConn.id)}
              style={{
                fontSize: '10px',
                padding: '3px 7px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
              title="Copy WhatsApp Connection ID"
            >
              {copiedText === 'sidebar-conn-' + activeConn.id ? (
                <>
                  <Check size={10} color="#25d366" />
                  <span style={{ color: '#25d366', fontWeight: 600 }}>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={10} />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* New Chat Prompt Bar */}
        {showNewChat && (
          <div style={{
            padding: '10px 14px',
            background: '#eef8f1',
            borderBottom: '1px solid #cbd5e1',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="tel"
              placeholder="+919567334117"
              value={newChatPhone}
              onChange={e => setNewChatPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #94a3b8',
                outline: 'none'
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                if (newChatPhone.trim()) {
                  setSelectedPhone(newChatPhone.trim());
                  setShowNewChat(false);
                  setNewChatPhone('');
                }
              }}
              style={{
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 600,
                background: '#008069',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setShowNewChat(false)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f0f2f5',
            borderRadius: '8px',
            padding: '0 10px',
            gap: '8px'
          }}>
            <Search size={15} color="#64748b" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                padding: '7px 0',
                fontSize: '12.5px',
                width: '100%',
                color: '#111b21'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '2px',
                  fontSize: '11px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
              <MessageCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>No conversations found</p>
              <button
                type="button"
                onClick={() => setShowNewChat(true)}
                style={{
                  marginTop: '12px',
                  background: '#008069',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Plus size={14} /> Start new chat
              </button>
            </div>
          ) : (
            filteredConversations.map(c => {
              const isSelected = c.phone === selectedPhone;
              const lastMsg = c.lastMessage;
              const body = lastMsg?.payload?.body || lastMsg?.kind || 'Message';
              const isOutbound = lastMsg?.direction === 'outbound';
              const isDelivered = lastMsg?.status === 'delivered';

              return (
                <div
                  key={c.phone}
                  className={`wb-wa-chat-item ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedPhone(c.phone)}
                >
                  {/* Contact Avatar Circle */}
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: isSelected ? '#008069' : '#e2e8f0',
                    color: isSelected ? '#ffffff' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0
                  }}>
                    {(c.name || c.phone).replace('+', '').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Chat Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '13.5px',
                        color: '#111b21',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {c.name || c.phone}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                        {formatTime(lastMsg?.created_at)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                        {isOutbound && (
                          <span style={{
                            color: isDelivered ? '#53bdeb' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '-1.5px',
                            flexShrink: 0
                          }}>
                            ✓✓
                          </span>
                        )}
                        <span style={{
                          fontSize: '12px',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {body}
                        </span>
                      </div>

                      {c.messages.length > 0 && (
                        <span style={{
                          background: isSelected ? '#008069' : '#e2e8f0',
                          color: isSelected ? '#ffffff' : '#475569',
                          fontSize: '10px',
                          fontWeight: 700,
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          marginLeft: '6px'
                        }}>
                          {c.messages.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* RIGHT PANE: REAL MOBILE SCREEN MOCKUP OR DESKTOP WEB */}
      {/* ========================================================================= */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#f1f5f9',
        position: 'relative',
        minWidth: 0
      }}>
        {/* Top Control Bar: Recipient Details & View Mode Toggle */}
        <header style={{
          height: '56px',
          padding: '0 20px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          {/* Selected Chat Contact Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {selectedPhone ? (
              <>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#008069',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px'
                }}>
                  {selectedPhone.replace('+', '').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                      {activeConversation?.name || selectedPhone}
                    </h3>
                    <button
                      type="button"
                      onClick={() => copyText(selectedPhone, 'top-phone-' + selectedPhone)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: '#64748b'
                      }}
                      title="Copy Phone Number"
                    >
                      {copiedText === 'top-phone-' + selectedPhone ? <Check size={12} color="#25d366" /> : <Copy size={12} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    Active recipient
                  </span>
                </div>
              </>
            ) : (
              <span style={{ fontSize: '13px', color: '#64748b' }}>Select a conversation</span>
            )}
          </div>

          {/* Controls: Mode Switcher & Transport Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View Mode Switcher */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('mobile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: viewMode === 'mobile' ? 700 : 500,
                  background: viewMode === 'mobile' ? '#008069' : 'transparent',
                  color: viewMode === 'mobile' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all .15s ease'
                }}
              >
                <Smartphone size={13} />
                <span>Mobile Mockup</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('desktop')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: viewMode === 'desktop' ? 700 : 500,
                  background: viewMode === 'desktop' ? '#008069' : 'transparent',
                  color: viewMode === 'desktop' ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all .15s ease'
                }}
              >
                <Monitor size={13} />
                <span>WhatsApp Web</span>
              </button>
            </div>

            {/* Transport switcher */}
            {connections.length > 1 && (
              <select
                value={activeConnectionId}
                onChange={e => setActiveConnectionId(e.target.value)}
                style={{
                  fontSize: '11px',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155'
                }}
              >
                {connections.map(cn => (
                  <option key={cn.id} value={cn.id}>
                    {cn.name} ({cn.provider === 'baileys' ? 'QR Web' : 'Meta'})
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* ===================================================================== */}
        {/* VIEW 1: REAL MOBILE SCREEN MOCKUP INSIDE WHATSAPP DESIGN */}
        {/* ===================================================================== */}
        {viewMode === 'mobile' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
          }}>
            {/* SMARTPHONE FRAME */}
            <div className="wb-phone-frame">
              {/* Dynamic Island / Top Speaker Notch */}
              <div className="wb-phone-notch">
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#1e293b', border: '1px solid #334155' }} />
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#0284c7' }} />
              </div>

              {/* Status Bar (Time, Battery, Signal) */}
              <div style={{
                height: '38px',
                padding: '0 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                fontSize: '11.5px',
                fontWeight: 600,
                background: '#008069',
                zIndex: 40
              }}>
                <span>{clockTime}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700 }}>5G</span>
                  {/* Signal bars */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5px', height: '10px' }}>
                    <div style={{ width: '2.5px', height: '3px', background: '#ffffff', borderRadius: '0.5px' }} />
                    <div style={{ width: '2.5px', height: '5px', background: '#ffffff', borderRadius: '0.5px' }} />
                    <div style={{ width: '2.5px', height: '7px', background: '#ffffff', borderRadius: '0.5px' }} />
                    <div style={{ width: '2.5px', height: '10px', background: '#ffffff', borderRadius: '0.5px' }} />
                  </div>
                  {/* Battery Pill */}
                  <div style={{
                    width: '18px',
                    height: '9px',
                    border: '1px solid #ffffff',
                    borderRadius: '2.5px',
                    padding: '1px',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <div style={{ width: '100%', height: '100%', background: '#22c55e', borderRadius: '1px' }} />
                  </div>
                </div>
              </div>

              {/* Real WhatsApp Mobile Navigation Header */}
              <div style={{
                height: '52px',
                background: '#008069',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff',
                zIndex: 30,
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <ArrowLeft size={18} color="#ffffff" style={{ cursor: 'pointer', flexShrink: 0 }} />
                  
                  {/* Contact Avatar */}
                  <div style={{
                    width: '35px',
                    height: '35px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    color: '#008069',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    flexShrink: 0
                  }}>
                    {(selectedPhone || 'WA').replace('+', '').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Name and Online Status */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '13.5px',
                      lineHeight: '1.2',
                      color: '#ffffff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {activeConversation?.name || selectedPhone || 'WhatsApp'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#d1fae5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }} />
                      online
                    </div>
                  </div>
                </div>

                {/* Right Action Icons (Video, Phone, 3-dots) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#ffffff' }}>
                  <Video size={17} style={{ cursor: 'pointer' }} />
                  <PhoneCall size={16} style={{ cursor: 'pointer' }} />
                  <MoreVertical size={17} style={{ cursor: 'pointer' }} />
                </div>
              </div>

              {/* WhatsApp Messages Stream with Authentic Wallpaper */}
              <div className="wb-doodle-bg" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {/* WhatsApp End-to-End Encryption Banner */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '7px',
                  padding: '6px 10px',
                  fontSize: '10px',
                  color: '#54656f',
                  textAlign: 'center',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
                  lineHeight: '1.4',
                  margin: '0 auto 6px',
                  maxWidth: '92%'
                }}>
                  🔒 Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
                </div>

                {/* Date Divider */}
                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '5px',
                    padding: '3px 8px',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: '#54656f',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.06)'
                  }}>
                    {formatDate(activeConversation?.messages?.[0]?.created_at)}
                  </span>
                </div>

                {/* Messages List */}
                {(!activeConversation || activeConversation.messages.length === 0) ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '30px 10px',
                    color: '#64748b',
                    fontSize: '12px'
                  }}>
                    <MessageCircle size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Say hello!</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                      Send a message below to start this conversation.
                    </p>
                  </div>
                ) : (
                  activeConversation.messages.map((m, idx) => {
                    const isOut = m.direction === 'outbound';
                    const body = m.payload?.body || (m.payload?.redacted ? '🔒 [OTP Code - Redacted for Privacy]' : JSON.stringify(m.payload));
                    const isDelivered = m.status === 'delivered';
                    const isFailed = m.status === 'failed';

                    return (
                      <div
                        key={m.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: isOut ? 'flex-end' : 'flex-start',
                          width: '100%'
                        }}
                      >
                        <div
                          className={isOut ? 'wb-bubble-out-tail' : 'wb-bubble-in-tail'}
                          style={{
                            maxWidth: '78%',
                            background: isOut ? '#d9fdd3' : '#ffffff',
                            color: '#111b21',
                            padding: '6px 10px 4px',
                            borderRadius: '8px',
                            borderTopRightRadius: isOut ? '0px' : '8px',
                            borderTopLeftRadius: isOut ? '8px' : '0px',
                            boxShadow: '0 1px 1px rgba(0,0,0,0.12)',
                            fontSize: '12.5px',
                            lineHeight: '1.4',
                            position: 'relative',
                            wordBreak: 'break-word'
                          }}
                        >
                          <div>{body}</div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '3px',
                            fontSize: '9.5px',
                            color: '#64748b',
                            marginTop: '2px',
                            float: 'right',
                            marginLeft: '8px'
                          }}>
                            <span>{formatTime(m.created_at)}</span>
                            {isOut && (
                              <span style={{
                                color: isDelivered ? '#53bdeb' : '#94a3b8',
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '-1.5px'
                              }}>
                                {isFailed ? '!' : isDelivered ? '✓✓' : m.status === 'sent' ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Real WhatsApp Mobile Bottom Message Bar (Composer) */}
              <div style={{
                padding: '8px 8px 12px',
                background: '#f0f2f5',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderTop: '1px solid #e2e8f0'
              }}>
                {/* White Rounded Input Pill */}
                <div style={{
                  flex: 1,
                  background: '#ffffff',
                  borderRadius: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 10px',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                }}>
                  <Smile size={19} color="#54656f" style={{ cursor: 'pointer', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Message"
                    value={inputMessage}
                    onChange={e => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending || !selectedPhone}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      padding: '6px 0',
                      fontSize: '13px',
                      color: '#111b21',
                      minWidth: 0
                    }}
                  />
                  <Paperclip size={17} color="#54656f" style={{ cursor: 'pointer', flexShrink: 0 }} />
                  <Camera size={17} color="#54656f" style={{ cursor: 'pointer', flexShrink: 0 }} />
                </div>

                {/* Floating Green Circle Send/Mic Button */}
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sending || !selectedPhone || !inputMessage.trim()}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#008069',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: sending || !inputMessage.trim() ? 'default' : 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                    color: '#ffffff',
                    flexShrink: 0,
                    opacity: sending ? 0.7 : 1,
                    transition: 'transform .1s ease'
                  }}
                  title="Send Message"
                >
                  {inputMessage.trim() ? (
                    <Send size={17} style={{ marginLeft: '2px' }} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
              </div>

              {/* Home Indicator */}
              <div style={{ height: '14px', background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '120px', height: '4px', background: '#475569', borderRadius: '2px' }} />
              </div>
            </div>
          </div>
        ) : (
          /* ===================================================================== */
          /* VIEW 2: FULL-WIDTH WHATSAPP WEB DESKTOP */
          /* ===================================================================== */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Desktop Messages Area */}
            <div className="wb-doodle-bg" style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 36px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '11px',
                color: '#54656f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                maxWidth: '460px',
                margin: '0 auto 12px',
                boxShadow: '0 1px 1px rgba(0,0,0,0.06)'
              }}>
                <ShieldCheck size={14} color="#008069" />
                <span>Messages are transmitted end-to-end through your connected WhatsApp transport.</span>
              </div>

              {activeConversation?.messages.map((m, idx) => {
                const isOut = m.direction === 'outbound';
                const body = m.payload?.body || (m.payload?.redacted ? '🔒 [OTP Code - Redacted for Privacy]' : JSON.stringify(m.payload));
                const isDelivered = m.status === 'delivered';
                const isFailed = m.status === 'failed';

                return (
                  <div
                    key={m.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: isOut ? 'flex-end' : 'flex-start',
                      width: '100%'
                    }}
                  >
                    <div
                      className={isOut ? 'wb-bubble-out-tail' : 'wb-bubble-in-tail'}
                      style={{
                        maxWidth: '65%',
                        padding: '8px 12px 6px',
                        borderRadius: '8px',
                        borderTopRightRadius: isOut ? '0px' : '8px',
                        borderTopLeftRadius: isOut ? '8px' : '0px',
                        position: 'relative',
                        fontSize: '13.5px',
                        lineHeight: '1.45',
                        boxShadow: '0 1px 0.5px rgba(0, 0, 0, 0.13)',
                        wordBreak: 'break-word',
                        background: isOut ? '#d9fdd3' : '#ffffff',
                        color: '#111b21'
                      }}
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{body}</div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '4px',
                        fontSize: '10px',
                        color: '#667781',
                        marginTop: '3px',
                        float: 'right',
                        marginLeft: '10px'
                      }}>
                        <span>{formatTime(m.created_at)}</span>
                        {isOut && (
                          <span style={{
                            color: isDelivered ? '#53bdeb' : '#8696a0',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            letterSpacing: '-1.5px'
                          }}>
                            {isFailed ? '!' : isDelivered ? '✓✓' : m.status === 'sent' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Desktop Composer */}
            <footer style={{
              minHeight: '62px',
              padding: '10px 20px',
              background: '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderTop: '1px solid #e2e8f0'
            }}>
              <Smile size={22} color="#54656f" style={{ cursor: 'pointer' }} />
              <Paperclip size={20} color="#54656f" style={{ cursor: 'pointer' }} />
              <input
                type="text"
                placeholder="Type a message"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending || !selectedPhone}
                style={{
                  flex: 1,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '11px 14px',
                  fontSize: '14px',
                  outline: 'none',
                  color: '#111b21'
                }}
              />
              <button
                type="button"
                disabled={sending || !selectedPhone || !inputMessage.trim()}
                onClick={handleSendMessage}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#008069',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending || !inputMessage.trim() ? 'default' : 'pointer',
                  color: '#ffffff',
                  opacity: sending || !inputMessage.trim() ? 0.5 : 1
                }}
                title="Send Message"
              >
                <Send size={18} style={{ marginLeft: '2px' }} />
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
