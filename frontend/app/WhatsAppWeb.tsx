'use client';
import { useState, useMemo, useRef, useEffect, KeyboardEvent } from 'react';
import { 
  Send, Search, Plus, Check, Copy, MessageCircle, Phone, 
  MoreVertical, Paperclip, Smile, ShieldCheck, ArrowLeft, RefreshCw
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  }, [activeConversation?.messages?.length, selectedPhone]);

  // Send a message directly from the WhatsApp Web composer
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
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'TODAY';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeConn = connections.find(c => c.id === activeConnectionId) || connections.find(c => c.status === 'CONNECTED') || connections[0];

  return (
    <div className="wa-web-root">
      {/* LEFT SIDEBAR: CHAT THREADS */}
      <aside className="wa-sidebar">
        {/* Profile / Toolbar Header */}
        <header className="wa-sidebar-header">
          <div className="wa-user-avatar" title="WhatsApp Connected Account">
            <span className="wa-status-dot" />
            <MessageCircle size={22} color="#ffffff" />
          </div>
          <div className="wa-sidebar-actions">
            <button
              type="button"
              className="wa-icon-btn"
              title="Start New Chat"
              onClick={() => setShowNewChat(true)}
            >
              <Plus size={19} />
            </button>
            <button
              type="button"
              className="wa-icon-btn"
              title="Refresh Messages"
              onClick={() => refresh(true)}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {/* New Chat Prompt Bar */}
        {showNewChat && (
          <div className="wa-new-chat-box">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="tel"
                placeholder="Recipient phone e.g. +919567334117"
                value={newChatPhone}
                onChange={e => setNewChatPhone(e.target.value)}
                className="wa-search-input"
                autoFocus
              />
              <button
                type="button"
                className="wa-btn-primary"
                onClick={() => {
                  if (newChatPhone.trim()) {
                    setSelectedPhone(newChatPhone.trim());
                    setShowNewChat(false);
                    setNewChatPhone('');
                  }
                }}
              >
                Chat
              </button>
              <button
                type="button"
                className="wa-icon-btn"
                onClick={() => setShowNewChat(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="wa-search-bar">
          <div className="wa-search-box">
            <Search size={16} className="wa-search-icon" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="wa-search-input"
            />
          </div>
        </div>

        {/* Chats List */}
        <div className="wa-conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="wa-no-chats">
              <MessageCircle size={32} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>No conversations yet</p>
              <button
                type="button"
                className="wa-btn-start"
                onClick={() => setShowNewChat(true)}
              >
                <Plus size={14} /> Start a conversation
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
                  className={`wa-chat-item ${isSelected ? 'wa-chat-item-active' : ''}`}
                  onClick={() => setSelectedPhone(c.phone)}
                >
                  <div className="wa-contact-avatar">
                    {(c.name || c.phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="wa-chat-content">
                    <div className="wa-chat-top-line">
                      <span className="wa-contact-name">{c.name || c.phone}</span>
                      <span className="wa-chat-time">{formatTime(lastMsg?.created_at)}</span>
                    </div>
                    <div className="wa-chat-bottom-line">
                      <div className="wa-msg-snippet">
                        {isOutbound && (
                          <span className={`wa-ticks ${isDelivered ? 'wa-ticks-blue' : ''}`}>
                            ✓✓
                          </span>
                        )}
                        <span className="wa-snippet-text">{body}</span>
                      </div>
                      {c.messages.length > 0 && (
                        <span className="wa-msg-count">{c.messages.length}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT CHAT WINDOW */}
      {selectedPhone ? (
        <section className="wa-chat-pane">
          {/* WhatsApp Web Chat Header */}
          <header className="wa-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="wa-contact-avatar wa-avatar-header">
                {selectedPhone.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="wa-header-title">{activeConversation?.name || selectedPhone}</h3>
                  <button
                    type="button"
                    className="wa-icon-btn-sm"
                    title="Copy Phone Number"
                    onClick={() => copyText(selectedPhone, 'phone-' + selectedPhone)}
                  >
                    {copiedText === 'phone-' + selectedPhone ? <Check size={12} color="#25d366" /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="wa-header-subtitle">
                  <span className="wa-online-dot" />
                  {activeConn ? `${activeConn.name} (${activeConn.status})` : 'Connected WhatsApp'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Transport Switcher */}
              {connections.length > 1 && (
                <select
                  value={activeConnectionId}
                  onChange={e => setActiveConnectionId(e.target.value)}
                  className="wa-transport-select"
                  title="Select WhatsApp Transport"
                >
                  {connections.map(cn => (
                    <option key={cn.id} value={cn.id}>
                      {cn.name} ({cn.provider === 'baileys' ? 'QR Web' : 'Meta'})
                    </option>
                  ))}
                </select>
              )}

              {activeConn?.id && (
                <button
                  type="button"
                  className="wa-btn-subtle"
                  title="Copy Connection ID"
                  onClick={() => copyText(activeConn.id, 'chat-conn-' + activeConn.id)}
                >
                  {copiedText === 'chat-conn-' + activeConn.id ? '✓ ID Copied' : 'Copy Connection ID'}
                </button>
              )}
            </div>
          </header>

          {/* Messages Stream Area with Authentic WhatsApp Wallpaper */}
          <div className="wa-messages-container">
            <div className="wa-encryption-banner">
              <ShieldCheck size={13} color="#54656f" />
              <span>Messages are transmitted end-to-end through your connected WhatsApp transport.</span>
            </div>

            {/* Date separator */}
            {activeConversation?.messages?.[0] && (
              <div className="wa-date-divider">
                <span>{formatDate(activeConversation.messages[0].created_at)}</span>
              </div>
            )}

            {activeConversation?.messages.map((m, idx) => {
              const isOut = m.direction === 'outbound';
              const body = m.payload?.body || (m.payload?.redacted ? '🔒 [OTP Code - Redacted for Privacy]' : JSON.stringify(m.payload));
              const isDelivered = m.status === 'delivered';
              const isFailed = m.status === 'failed';

              return (
                <div
                  key={m.id || idx}
                  className={`wa-message-row ${isOut ? 'wa-row-out' : 'wa-row-in'}`}
                >
                  <div className={`wa-bubble ${isOut ? 'wa-bubble-out' : 'wa-bubble-in'}`}>
                    <div className="wa-bubble-text">{body}</div>
                    <div className="wa-bubble-meta">
                      <span className="wa-bubble-time">{formatTime(m.created_at)}</span>
                      {isOut && (
                        <span className={`wa-bubble-ticks ${isDelivered ? 'wa-ticks-blue' : ''}`}>
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

          {/* WhatsApp Web Message Composer */}
          <footer className="wa-composer">
            <button type="button" className="wa-composer-icon" title="Emoji">
              <Smile size={22} color="#54656f" />
            </button>
            <button type="button" className="wa-composer-icon" title="Attach file">
              <Paperclip size={20} color="#54656f" />
            </button>

            <input
              type="text"
              placeholder="Type a message"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="wa-composer-input"
              disabled={sending}
            />

            <button
              type="button"
              className="wa-send-btn"
              disabled={sending || !inputMessage.trim()}
              onClick={handleSendMessage}
              title="Send Message (Enter)"
            >
              <Send size={18} color="#ffffff" style={{ marginLeft: '2px' }} />
            </button>
          </footer>
        </section>
      ) : (
        /* Empty Splash Screen when no chat selected */
        <div className="wa-splash-pane">
          <div className="wa-splash-content">
            <div className="wa-splash-icon">
              <MessageCircle size={64} color="#00a884" />
            </div>
            <h2>WhatsApp Web for Developers</h2>
            <p>
              Send and receive messages directly through your connected WhatsApp transport in real time.
            </p>
            <button
              type="button"
              className="wa-btn-primary"
              style={{ padding: '10px 20px', fontSize: '13px', margin: '16px auto 0' }}
              onClick={() => setShowNewChat(true)}
            >
              <Plus size={16} /> Start a conversation
            </button>
            <div className="wa-splash-footer">
              <ShieldCheck size={14} color="#8696a0" />
              <span>Tenant-isolated · Official provider rules apply</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
