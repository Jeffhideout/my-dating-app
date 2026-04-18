'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function ChatPage() {
  const [user, setUser] = useState(null)
  const [rooms, setRooms] = useState([])
  const [activeRoom, setActiveRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [profile, setProfile] = useState(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    getUser()
  }, [])

  useEffect(() => {
    if (activeRoom) {
      fetchMessages(activeRoom.id)
      subscribeToMessages(activeRoom.id)
    }
  }, [activeRoom])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(profile)

    fetchRooms(user.id)
  }

  const fetchRooms = async (userId) => {
    const { data } = await supabase
      .from('chat_rooms')
      .select(`
        *,
        user1:profiles!chat_rooms_user1_id_fkey(*),
        user2:profiles!chat_rooms_user2_id_fkey(*)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    setRooms(data || [])
    setLoading(false)
  }

  const fetchMessages = async (roomId) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  const subscribeToMessages = (roomId) => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeRoom) return

    if (profile?.free_messages_remaining <= 0 && !activeRoom.is_unlocked) {
      alert('Your free messages are used up! Send a gift to continue chatting 🎁')
      window.location.href = `/gifts?to=${getOtherUser(activeRoom).id}&name=${getOtherUser(activeRoom).username}`
      return
    }

    setSending(true)

    await supabase.from('messages').insert({
      room_id: activeRoom.id,
      sender_id: user.id,
      content: newMessage.trim(),
      type: 'text'
    })

    await supabase
      .from('chat_rooms')
      .update({
        last_message: newMessage.trim(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', activeRoom.id)

    if (profile?.free_messages_remaining > 0) {
      await supabase
        .from('profiles')
        .update({ free_messages_remaining: profile.free_messages_remaining - 1 })
        .eq('id', user.id)
      setProfile(prev => ({ ...prev, free_messages_remaining: prev.free_messages_remaining - 1 }))
    }

    setNewMessage('')
    setSending(false)
  }

  const getOtherUser = (room) => {
    if (!room || !user) return {}
    return room.user1_id === user.id ? room.user2 : room.user1
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-500 text-xl font-bold">Loading...</div>
      </div>
    )
  }

  // Active Chat Room
  if (activeRoom) {
    const otherUser = getOtherUser(activeRoom)
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* Chat Header */}
        <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
          <button onClick={() => setActiveRoom(null)} className="text-gray-400 text-2xl">←</button>
          <div className="w-10 h-10 bg-pink-200 rounded-full flex items-center justify-center text-xl">
            👤
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-800">@{otherUser?.username}</div>
            <div className="text-green-400 text-xs">Online</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/call?to=${otherUser?.id}&name=${otherUser?.username}&type=audio`}
              className="bg-green-50 text-green-500 text-xl px-3 py-1.5 rounded-full font-semibold"
            >
              📞
            </a>
            <a
              href={`/call?to=${otherUser?.id}&name=${otherUser?.username}&type=video`}
              className="bg-blue-50 text-blue-500 text-xl px-3 py-1.5 rounded-full font-semibold"
            >
              📹
            </a>
            <a
              href={`/gifts?to=${otherUser?.id}&name=${otherUser?.username}`}
              className="bg-pink-50 text-pink-500 text-xs px-3 py-1.5 rounded-full font-semibold"
            >
              🎁 Gift
            </a>
          </div>
        </div>

        {/* Free messages banner */}
        {profile?.free_messages_remaining > 0 && (
          <div className="bg-blue-50 px-4 py-2 text-center text-blue-600 text-xs font-semibold">
            💬 {profile.free_messages_remaining} free messages remaining
          </div>
        )}

        {/* Locked banner */}
        {!activeRoom.is_unlocked && profile?.free_messages_remaining <= 0 && (
          <div className="bg-yellow-50 px-4 py-3 text-center">
            <p className="text-yellow-600 text-sm font-semibold">
              🔒 Send a gift to unlock unlimited chat!
            </p>
            <a
              href={`/gifts?to=${otherUser?.id}&name=${otherUser?.username}`}
              className="inline-block mt-2 bg-pink-500 text-white text-xs px-4 py-2 rounded-full font-bold"
            >
              🎁 Send a Gift Now
            </a>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <div className="text-4xl mb-2">👋</div>
              <p>Say hello to @{otherUser?.username}!</p>
              <p className="text-xs mt-2 text-gray-300">
                You can also start a 📞 call or 📹 video call
              </p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
                  msg.sender_id === user.id
                    ? 'bg-pink-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 shadow-sm rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white px-4 py-3 flex items-center gap-2 shadow-lg">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="bg-pink-500 text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    )
  }

  // Rooms List
  return (
    <div className="min-h-screen bg-pink-50 pb-10">

      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <a href="/dashboard" className="text-gray-400 text-2xl">←</a>
        <h1 className="font-bold text-gray-800 text-lg">Messages</h1>
      </div>

      {/* Free messages remaining */}
      <div className="mx-4 mt-4 bg-blue-50 rounded-2xl p-3 text-center">
        <p className="text-blue-600 text-sm font-semibold">
          💬 {profile?.free_messages_remaining || 0} free messages remaining
        </p>
        <p className="text-blue-400 text-xs mt-1">
          📞 {profile?.free_audio_calls_remaining || 0} free audio calls •
          📹 {profile?.free_video_calls_remaining || 0} free video calls
        </p>
      </div>

      {/* Rooms */}
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20">
          <div className="text-6xl">💬</div>
          <p className="text-gray-400 mt-3">No chats yet</p>
          <p className="text-gray-300 text-sm">Browse people and send gifts to start chatting!</p>
          <a
            href="/browse"
            className="mt-4 bg-pink-500 text-white px-6 py-3 rounded-2xl font-bold"
          >
            Browse People
          </a>
        </div>
      ) : (
        <div className="mt-4 space-y-1">
          {rooms.map(room => {
            const other = getOtherUser(room)
            return (
              <div
                key={room.id}
                onClick={() => setActiveRoom(room)}
                className="bg-white px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-pink-50 transition"
              >
                <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center text-2xl">
                  👤
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800">@{other?.username}</span>
                    {!room.is_unlocked && (
                      <span className="text-xs text-yellow-500 font-semibold">🔒 Locked</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">
                    {room.last_message || 'Send a message...'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <a
                    href={`/call?to=${other?.id}&name=${other?.username}&type=audio`}
                    onClick={e => e.stopPropagation()}
                    className="text-green-500 text-xl p-1"
                  >
                    📞
                  </a>
                  <a
                    href={`/call?to=${other?.id}&name=${other?.username}&type=video`}
                    onClick={e => e.stopPropagation()}
                    className="text-blue-500 text-xl p-1"
                  >
                    📹
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}