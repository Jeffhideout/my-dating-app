'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COUNTRY_FLAGS = {
  'kenya': '🇰🇪', 'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'uganda': '🇺🇬',
  'tanzania': '🇹🇿', 'south africa': '🇿🇦', 'ethiopia': '🇪🇹', 'rwanda': '🇷🇼',
  'usa': '🇺🇸', 'uk': '🇬🇧', 'canada': '🇨🇦', 'australia': '🇦🇺',
  'nairobi': '🇰🇪', 'mombasa': '🇰🇪', 'kisumu': '🇰🇪', 'eldoret': '🇰🇪',
  'nakuru': '🇰🇪', 'lagos': '🇳🇬', 'accra': '🇬🇭', 'kampala': '🇺🇬',
}

function getFlag(location) {
  if (!location) return '🌍'
  const lower = location.toLowerCase()
  for (const [key, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (lower.includes(key)) return flag
  }
  return '🌍'
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [likedUsers, setLikedUsers] = useState([])
  const [activeTab, setActiveTab] = useState('forYou')

  // Notification counts
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadGifts, setUnreadGifts] = useState(0)

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)

    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(profile)

    if (!profile?.full_name || !profile?.profile_photo) {
      window.location.href = '/profile'
      return
    }

    const { data: wallet } = await supabase
      .from('coin_wallets').select('*').eq('user_id', user.id).single()
    setWallet(wallet)

    // Get users to browse
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .eq('is_banned', false)
      .not('profile_photo', 'is', null)
      .limit(30)
    setNearbyUsers(users || [])

    // Get notification counts
    await loadNotificationCounts(user.id)

    // Daily bonus
    const today = new Date().toISOString().split('T')[0]
    if (profile?.last_daily_bonus !== today) {
      claimDailyBonus(user.id, profile, wallet)
    }

    setLoading(false)
  }

  const loadNotificationCounts = async (userId) => {
    // Pending friend requests
    const { count: reqCount } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('status', 'pending')
    setPendingRequests(reqCount || 0)

    // Unread notifications (likes, comments etc)
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setUnreadNotifications(notifCount || 0)

    // Unread messages
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_seen', false)
      .neq('sender_id', userId)
    setUnreadMessages(msgCount || 0)

    // Unread gifts
    const { count: giftCount } = await supabase
      .from('sent_gifts')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_seen', false)
    setUnreadGifts(giftCount || 0)
  }

  const claimDailyBonus = async (userId, profileData, walletData) => {
    const today = new Date().toISOString().split('T')[0]
    if (!profileData || !walletData) return
    if (profileData.last_daily_bonus === today) return

    await supabase.from('profiles').update({ last_daily_bonus: today }).eq('id', userId)
    const newBalance = (walletData?.balance || 0) + 5
    await supabase.from('coin_wallets').update({ balance: newBalance }).eq('user_id', userId)
    await supabase.from('coin_transactions').insert({
      user_id: userId, type: 'bonus', amount: 5,
      description: 'Daily login bonus', balance_after: newBalance,
    })
    setWallet(prev => ({ ...prev, balance: newBalance }))
    setMessage('🎉 +5 coins daily login bonus!')
    setTimeout(() => setMessage(''), 4000)
  }

  const likeUser = (userId) => {
    if (likedUsers.includes(userId)) {
      setLikedUsers(prev => prev.filter(id => id !== userId))
    } else {
      setLikedUsers(prev => [...prev, userId])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">💝</div>
          <div className="text-pink-500 font-bold">Loading HeartLink...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Navigation */}
      <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <a href="/profile" className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-pink-200 flex items-center justify-center border-2 border-pink-400">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </a>
          <div>
            <div className="font-bold text-gray-900 text-sm">
              {profile?.full_name || profile?.username}
            </div>
            <div className="text-gray-400 text-xs">
              {getFlag(profile?.location)} {profile?.location || 'Add location'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/coins" className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1">
            <span>🪙</span>
            <span className="font-bold text-yellow-600 text-sm">{wallet?.balance || 0}</span>
          </a>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="mx-4 mt-2 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white px-4 pt-2 border-b border-gray-100">
        {['forYou', 'nearby', 'dating', 'friends'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
              activeTab === tab ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400'
            }`}
          >
            {tab === 'forYou' ? 'For You' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Users Grid */}
      <div className="px-3 pt-3 pb-24">
        {nearbyUsers.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-3">👥</div>
            <p className="text-gray-500 font-semibold">No users yet</p>
            <p className="text-gray-400 text-sm mt-1">Invite friends to join!</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://my-dating-app-eight.vercel.app?ref=${profile?.referral_code}`)
                setMessage('✅ Invite link copied! Share it to earn 50 coins per friend!')
              }}
              className="mt-4 bg-pink-500 text-white px-6 py-2 rounded-full font-bold text-sm"
            >
              🔗 Invite Friends (+50 coins each)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {nearbyUsers
              .filter(u => {
                if (activeTab === 'dating') return u.looking_for === 'dating' || u.looking_for === 'both'
                if (activeTab === 'friends') return u.looking_for === 'friendship' || u.looking_for === 'both'
                return true
              })
              .map(u => (
                <div key={u.id} className="relative rounded-2xl overflow-hidden bg-white shadow-sm">
                  {/* Clickable photo → opens profile */}
                  <a href={`/user/${u.id}`}>
                    <div className="aspect-square relative">
                      {u.profile_photo ? (
                        <img
                          src={u.profile_photo}
                          alt={u.full_name || u.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-pink-200 to-red-200 flex items-center justify-center">
                          <span className="text-4xl">
                            {u.gender === 'male' ? '👨' : u.gender === 'female' ? '👩' : '🧑'}
                          </span>
                        </div>
                      )}
                      {/* Flag */}
                      <div className="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow">
                        {getFlag(u.location)}
                      </div>
                      {/* Like button */}
                      <button
                        onClick={(e) => { e.preventDefault(); likeUser(u.id) }}
                        className="absolute bottom-1 right-1 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-sm"
                      >
                        {likedUsers.includes(u.id) ? '❤️' : '🤍'}
                      </button>
                    </div>
                  </a>

                  {/* Info */}
                  <div className="p-2">
                    <a href={`/user/${u.id}`}>
                      <div className="font-bold text-gray-900 text-xs truncate">
                        {u.full_name || u.username}{u.age ? `, ${u.age}` : ''}
                      </div>
                      {u.location && (
                        <div className="text-gray-400 text-xs truncate">{u.location}</div>
                      )}
                    </a>
                    <div className="flex gap-1 mt-1.5">
                      <a
                        href={`/gifts?to=${u.id}&name=${u.full_name || u.username}`}
                        className="flex-1 bg-yellow-50 text-yellow-600 text-xs py-1 rounded-lg font-bold text-center"
                      >
                        🎁
                      </a>
                      <a
                        href={`/user/${u.id}`}
                        className="flex-1 bg-pink-500 text-white text-xs py-1 rounded-lg font-bold text-center"
                      >
                        👤
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation with red dot notifications */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-2 flex items-center justify-around z-10">
        <a href="/dashboard" className="flex flex-col items-center gap-0.5">
          <span className="text-2xl">🏠</span>
          <span className="text-xs text-pink-500 font-bold">Home</span>
        </a>

        <a href="/posts" className="flex flex-col items-center gap-0.5">
          <span className="text-2xl">📝</span>
          <span className="text-xs text-gray-400 font-semibold">Posts</span>
        </a>

        <a href="/chat" className="flex flex-col items-center gap-0.5 relative">
          <span className="text-2xl">💬</span>
          {unreadMessages > 0 && (
            <span className="absolute -top-1 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">Chats</span>
        </a>

        <a href="/gifts" className="flex flex-col items-center gap-0.5 relative">
          <span className="text-2xl">🎁</span>
          {unreadGifts > 0 && (
            <span className="absolute -top-1 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {unreadGifts > 9 ? '9+' : unreadGifts}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">Gifts</span>
        </a>

        <a href="/notifications" className="flex flex-col items-center gap-0.5 relative">
          <span className="text-2xl">🔔</span>
          {pendingRequests > 0 && (
            <span className="absolute -top-1 right-0 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {pendingRequests > 9 ? '9+' : pendingRequests}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">Requests</span>
        </a>
      </div>
    </div>
  )
}