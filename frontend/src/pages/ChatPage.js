import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function Avatar({ name, color, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color || '#6366f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0, textTransform: 'uppercase'
    }}>
      {name?.[0] || '?'}
    </div>
  );
}

function Message({ msg, isOwn, showAvatar }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div style={{ display: 'flex', gap: 10, padding: '2px 16px', flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
      <div style={{ width: 32, flexShrink: 0 }}>
        {showAvatar && <Avatar name={msg.username} color={msg.avatar_color} size={32} />}
      </div>
      <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
        {showAvatar && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
            <span style={{ color: isOwn ? '#a5b4fc' : '#c4b5fd', fontSize: 12, fontWeight: 600 }}>{msg.username}</span>
            <span style={{ color: '#444', fontSize: 11 }}>{time}</span>
          </div>
        )}
        <div style={{
          padding: '8px 14px', borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isOwn ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1a1a2e',
          color: '#e2e8f0', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
          border: isOwn ? 'none' : '1px solid #1e1e3a'
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { user, token, logout } = useAuth();
  const { socket, connected } = useSocket(token);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [online, setOnline] = useState([]);
  const [typing, setTyping] = useState([]);
  const [newRoom, setNewRoom] = useState({ show: false, name: '', description: '' });
  const [roomError, setRoomError] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    axios.get(`${API}/api/rooms`).then(r => {
      setRooms(r.data);
      if (r.data.length > 0) setActiveRoom(r.data[0]);
    });
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    axios.get(`${API}/api/rooms/${activeRoom.id}/messages`).then(r => setMessages(r.data));
    axios.get(`${API}/api/rooms/${activeRoom.id}/online`).then(r => setOnline(r.data));
    setTyping([]);
  }, [activeRoom]);

  useEffect(() => {
    if (!socket || !activeRoom) return;
    socket.emit('join_room', activeRoom.id);
    socket.on('new_message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('presence_update', ({ roomId, online: o }) => {
      if (roomId == activeRoom.id) setOnline(o);
    });
    socket.on('user_typing', ({ username, roomId }) => {
      if (roomId == activeRoom.id && username !== user.username)
        setTyping(prev => prev.includes(username) ? prev : [...prev, username]);
    });
    socket.on('user_stop_typing', ({ username }) => {
      setTyping(prev => prev.filter(u => u !== username));
    });
    return () => {
      socket.emit('leave_room', activeRoom.id);
      socket.off('new_message');
      socket.off('presence_update');
      socket.off('user_typing');
      socket.off('user_stop_typing');
    };
  }, [socket, activeRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket || !activeRoom) return;
    socket.emit('send_message', { roomId: activeRoom.id, content: input });
    setInput('');
    socket.emit('stop_typing', { roomId: activeRoom.id });
  };

  const handleTyping = (e) => {
    setInput(e.target.value);
    if (!socket || !activeRoom) return;
    socket.emit('typing', { roomId: activeRoom.id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('stop_typing', { roomId: activeRoom.id }), 1500);
  };

  const createRoom = async () => {
    if (!newRoom.name.trim()) return;
    setRoomError('');
    try {
      const res = await axios.post(`${API}/api/rooms`, { name: newRoom.name, description: newRoom.description });
      setRooms(prev => [...prev, res.data]);
      setActiveRoom(res.data);
      setNewRoom({ show: false, name: '', description: '' });
    } catch (err) {
      setRoomError(err.response?.data?.error || 'Failed to create room');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', fontFamily: "'DM Sans', sans-serif", color: '#e2e8f0' }}>
      {/* Sidebar */}
      <div style={{ width: 260, background: '#0d0d17', borderRight: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #1a1a2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>NexusChat</span>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: connected ? '#10b981' : '#ef4444', boxShadow: connected ? '0 0 6px #10b981' : 'none' }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 8px' }}>
            <span style={{ color: '#555', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</span>
            <button onClick={() => setNewRoom({ show: true, name: '', description: '' })}
              style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>+</button>
          </div>
          {rooms.map(room => (
            <div key={room.id} onClick={() => setActiveRoom(room)}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: activeRoom?.id === room.id ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: activeRoom?.id === room.id ? '#a5b4fc' : '#888',
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8
              }}>
              <span style={{ color: '#444', fontSize: 16 }}>#</span>
              <span style={{ fontSize: 14, fontWeight: activeRoom?.id === room.id ? 600 : 400 }}>{room.name}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={user.username} color={user.avatar_color} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
            <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}/>Online
            </div>
          </div>
          <button onClick={logout} title="Sign out"
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeRoom ? (
          <>
            <div style={{ padding: '0 24px', height: 60, borderBottom: '1px solid #1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0d17' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#6366f1', fontSize: 20 }}>#</span>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{activeRoom.name}</span>
                {activeRoom.description && <span style={{ color: '#555', fontSize: 13 }}>— {activeRoom.description}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {online.slice(0, 5).map(u => (
                  <div key={u} title={u} style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', border: '2px solid #0d0d17', textTransform: 'uppercase' }}>{u[0]}</div>
                ))}
                {online.length > 0 && <span style={{ color: '#555', fontSize: 12, marginLeft: 4 }}>{online.length} online</span>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16, paddingBottom: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#333', padding: '60px 24px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
                  <div style={{ fontWeight: 600, color: '#555' }}>Welcome to #{activeRoom.name}</div>
                  <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>Be the first to say something!</div>
                </div>
              )}
              {messages.map((msg, i) => {
                const prev = messages[i - 1];
                const showAvatar = !prev || prev.user_id !== msg.user_id || new Date(msg.created_at) - new Date(prev.created_at) > 5 * 60 * 1000;
                return (
                  <div key={msg.id} style={{ marginBottom: showAvatar && i > 0 ? 12 : 2 }}>
                    <Message msg={msg} isOwn={msg.user_id === user.id} showAvatar={showAvatar} />
                  </div>
                );
              })}
              {typing.length > 0 && (
                <div style={{ padding: '4px 58px', color: '#666', fontSize: 12, fontStyle: 'italic' }}>
                  {typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a2e', background: '#0d0d17' }}>
              <form onSubmit={sendMessage} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input value={input} onChange={handleTyping}
                  placeholder={`Message #${activeRoom.name}`}
                  style={{ flex: 1, padding: '12px 16px', background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                />
                <button type="submit" disabled={!input.trim()}
                  style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1a1a2e', color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>
            Select a channel to start chatting
          </div>
        )}
      </div>

      {/* Create room modal */}
      {newRoom.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setNewRoom({ show: false, name: '', description: '' })}>
          <div style={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Create a Channel</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Name</label>
              <input value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="e.g. design-feedback" autoFocus
                style={{ width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase' }}>Description</label>
              <input value={newRoom.description} onChange={e => setNewRoom({ ...newRoom, description: e.target.value })}
                placeholder="What's this channel for?"
                style={{ width: '100%', padding: '10px 14px', background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>
            {roomError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{roomError}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setNewRoom({ show: false, name: '', description: '' })}
                style={{ flex: 1, padding: '10px', background: '#1a1a2e', border: 'none', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={createRoom}
                style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}