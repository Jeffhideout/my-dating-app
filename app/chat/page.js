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
      const unsub = subscribeToMessages(activeRoom.id)
      return unsub
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
      const other = getOtherUser(activeRoom)
      window.location.href = `/gifts?to=${other.id}&name=${other.username}`
      return
    }

    setSending(true)

    const { error } = await supabase.from('messages').insert({
      room_id: activeRoom.id,
      sender_id: user.id,
      content: newMessage.trim(),
      type: 'text'
    })

    if (error) {
      alert('Error sending message: ' + error.message)
      setSending(false)
      return
    }

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
          <button
            onClick={() => setActiveRoom(null)}
            className="text-gray-500 text-2xl font-bold"
          >
            ←
          </button>
          <div className="w-10 h-10 bg-pink-200 rounded-full overflow-hidden flex items-center justify-center">
            {otherUser?.profile_photo ? (
              <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl">👤</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">@{otherUser?.username}</div>
            <div className="text-green-500 text-xs font-semibold">● Online</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/call?to=${otherUser?.id}&name=${otherUser?.username}&type=audio`}
              className="bg-green-100 text-green-600 text-xl px-3 py-1.5 rounded-full"
            >
              📞
            </a>
            <a
              href={`/call?to=${otherUser?.id}&name=${otherUser?.username}&type=video`}
              className="bg-blue-100 text-blue-600 text-xl px-3 py-1.5 rounded-full"
            >
              📹
            </a>
            <a
              href={`/gifts?to=${otherUser?.id}&name=${otherUser?.username}`}
              className="bg-pink-100 text-pink-600 text-xs px-3 py-1.5 rounded-full font-bold"
            >
              🎁
            </a>
          </div>
        </div>

        {/* Free messages banner */}
        {(profile?.free_messages_remaining || 0) > 0 && (
          <div className="bg-blue-50 px-4 py-2 text-center">
            <p className="text-blue-600 text-xs font-semibold">
              💬 {profile.free_messages_remaining} free messages remaining
            </p>
          </div>
        )}

        {/* Locked banner */}
        {!activeRoom.is_unlocked && (profile?.free_messages_remaining || 0) <= 0 && (
          <div className="bg-yellow-50 px-4 py-3 text-center border-b border-yellow-100">
            <p className="text-yellow-700 text-sm font-semibold">
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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <div className="text-5xl mb-3">👋</div>
              <p className="font-semibold">Say hello to @{otherUser?.username}!</p>
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
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm font-medium ${
                  msg.sender_id === user.id
                    ? 'bg-pink-500 text-white rounded-br-none'
                    : 'bg-white text-gray-900 shadow-sm rounded-bl-none border border-gray-100'
                }`}>
                  {msg.content}
                  <div className={`text-xs mt-1 ${
                    msg.sender_id === user.id ? 'text-pink-200' : 'text-gray-400'
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white px-4 py-3 flex items-center gap-3 border-t border-gray-100 shadow-lg">
          <div className="flex-1 bg-gray-100 rounded-full flex items-center px-4 py-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-gray-900 text-sm focus:outline-none placeholder-gray-500"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            className="bg-pink-500 text-white w-11 h-11 rounded-full flex items-center justify-center shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span className="text-lg">➤</span>
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
        <a href="/dashboard" className="text-gray-500 text-2xl font-bold">←</a>
        <h1 className="font-bold text-gray-900 text-lg">Messages</h1>
      </div>

      {/* Free stats */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-3 shadow-sm">
        <div className="flex justify-around text-center">
          <div>
            <div className="text-blue-500 font-bold">{profile?.free_messages_remaining || 0}</div>
            <div className="text-gray-400 text-xs">💬 Free msgs</div>
          </div>
          <div>
            <div className="text-green-500 font-bold">{profile?.free_audio_calls_remaining || 0}</div>
            <div className="text-gray-400 text-xs">📞 Audio calls</div>
          </div>
          <div>
            <div className="text-blue-500 font-bold">{profile?.free_video_calls_remaining || 0}</div>
            <div className="text-gray-400 text-xs">📹 Video calls</div>
          </div>
        </div>
        <p className="text-center text-gray-400 text-xs mt-2">
          Send a gift to unlock unlimited chat!
        </p>
      </div>

      {/* Rooms */}
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20">
          <div className="text-6xl">💬</div>
          <p className="text-gray-500 font-semibold mt-3">No chats yet</p>
          <p className="text-gray-400 text-sm mt-1">Browse people and connect to start chatting!</p>
          <a
            href="/browse"
            className="mt-4 bg-pink-500 text-white px-6 py-3 rounded-2xl font-bold shadow-md"
          >
            Browse People
          </a>
        </div>
      ) : (
        <div className="mt-4 bg-white rounded-2xl mx-4 shadow-sm overflow-hidden">
          {rooms.map((room, index) => {
            const other = getOtherUser(room)
            return (
              <div key={room.id}>
                <div
                  onClick={() => setActiveRoom(room)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-pink-50 transition active:bg-pink-100"
                >
                  <div className="w-12 h-12 bg-pink-200 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                    {other?.profile_photo ? (
                      <img src={other.profile_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">👤</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">@{other?.username}</span>
                      <div className="flex items-center gap-2">
                        {!room.is_unlocked && (
                          <span className="text-xs text-yellow-500 font-semibold">🔒</span>
                        )}
                        <span className="text-gray-400 text-xs">
                          {room.last_message_at
                            ? new Date(room.last_message_at).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm truncate mt-0.5">
                      {room.last_message || 'Tap to start chatting...'}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
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
                {index < rooms.length - 1 && (
                  <div className="border-b border-gray-50 mx-4" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}