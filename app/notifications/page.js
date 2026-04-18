'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationsPage() {
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('requests')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)
    fetchRequests(user.id)
    fetchNotifications(user.id)
  }

  const fetchRequests = async (userId) => {
    const { data } = await supabase
      .from('connections')
      .select('*, profiles!connections_sender_id_fkey(*)')
      .eq('receiver_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const fetchNotifications = async (userId) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  const handleRequest = async (requestId, senderId, action) => {
    const { error } = await supabase
      .from('connections')
      .update({ status: action })
      .eq('id', requestId)

    if (error) {
      setMessage('Error: ' + error.message)
      return
    }

    if (action === 'accepted') {
      // Create chat room
      const user1 = user.id < senderId ? user.id : senderId
      const user2 = user.id < senderId ? senderId : user.id

      await supabase.from('chat_rooms').insert({
        user1_id: user1,
        user2_id: user2,
        is_unlocked: false,
      }).select()

      // Send notification to sender
      await supabase.from('notifications').insert({
        user_id: senderId,
        type: 'connection_accepted',
        title: 'Request Accepted!',
        body: 'Your connection request was accepted! Start chatting now.',
      })

      setMessage('Request accepted! You can now chat 💬')
    } else {
      setMessage('Request declined.')
    }

    // Remove from list
    setRequests(prev => prev.filter(r => r.id !== requestId))
    setTimeout(() => setMessage(''), 3000)
  }

  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    )
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'gift_received': return '🎁'
      case 'connection_request': return '👋'
      case 'connection_accepted': return '💝'
      case 'new_message': return '💬'
      case 'coin_purchase': return '🪙'
      default: return '🔔'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-500 text-xl font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pink-50 pb-10">

      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <a href="/dashboard" className="text-gray-400 text-2xl">←</a>
        <h1 className="font-bold text-gray-800 text-lg">Notifications</h1>
        {requests.length > 0 && (
          <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {requests.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white mx-4 mt-4 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'requests' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          👋 Requests {requests.length > 0 && `(${requests.length})`}
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'notifications' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          🔔 Notifications
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="mx-4 mt-3 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="px-4 mt-4 space-y-3">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20">
              <div className="text-6xl">👋</div>
              <p className="text-gray-400 mt-3">No pending requests</p>
            </div>
          ) : (
            requests.map(request => (
              <div key={request.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center text-2xl">
                    👤
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">
                      @{request.profiles?.username}
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 ${
                      request.type === 'dating' ? 'text-pink-500' : 'text-blue-500'
                    }`}>
                      {request.type === 'dating' ? '💝 Dating Request' : '👋 Friendship Request'}
                    </div>
                    <div className="text-gray-400 text-xs mt-0.5">
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleRequest(request.id, request.sender_id, 'declined')}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl font-semibold text-sm"
                  >
                    ✕ Decline
                  </button>
                  <button
                    onClick={() => handleRequest(request.id, request.sender_id, 'accepted')}
                    className="flex-1 bg-pink-500 text-white py-2 rounded-xl font-semibold text-sm"
                  >
                    ✓ Accept
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="mt-4 space-y-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20">
              <div className="text-6xl">🔔</div>
              <p className="text-gray-400 mt-3">No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`bg-white px-4 py-3 flex items-center gap-3 cursor-pointer ${
                  !notification.is_read ? 'border-l-4 border-pink-500' : ''
                }`}
              >
                <div className="text-3xl">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 text-sm">
                    {notification.title}
                  </div>
                  <div className="text-gray-400 text-xs mt-0.5">
                    {notification.body}
                  </div>
                  <div className="text-gray-300 text-xs mt-0.5">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </div>
                </div>
                {!notification.is_read && (
                  <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}