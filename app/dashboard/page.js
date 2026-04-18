'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COUNTRY_FLAGS = {
  'kenya': '🇰🇪', 'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'uganda': '🇺🇬',
  'tanzania': '🇹🇿', 'south africa': '🇿🇦', 'ethiopia': '🇪🇹',
  'usa': '🇺🇸', 'uk': '🇬🇧', 'canada': '🇨🇦', 'australia': '🇦🇺',
  'india': '🇮🇳', 'germany': '🇩🇪', 'france': '🇫🇷', 'brazil': '🇧🇷',
  'nairobi': '🇰🇪', 'lagos': '🇳🇬', 'accra': '🇬🇭', 'kampala': '🇺🇬',
  'dar es salaam': '🇹🇿', 'johannesburg': '🇿🇦', 'cape town': '🇿🇦',
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
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dailyClaimed, setDailyClaimed] = useState(false)
  const [message, setMessage] = useState('')
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [likedUsers, setLikedUsers] = useState([])

  useEffect(() => {
    getUser()
  }, [])

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

    const { data: wallet } = await supabase
      .from('coin_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single()
    setWallet(wallet)

    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
    setPendingRequests(count || 0)

    // Fetch nearby users
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .eq('is_banned', false)
      .limit(20)
    setNearbyUsers(users || [])

    // Check daily bonus
    const today = new Date().toISOString().split('T')[0]
    if (profile?.last_daily_bonus !== today) {
      claimDailyBonus(user.id, profile, wallet)
    } else {
      setDailyClaimed(true)
    }

    setLoading(false)
  }

  const claimDailyBonus = async (userId, profileData, walletData) => {
    const today = new Date().toISOString().split('T')[0]
    if (!profileData || !walletData) return
    if (profileData.last_daily_bonus === today) { setDailyClaimed(true); return }

    await supabase.from('profiles').update({ last_daily_bonus: today }).eq('id', userId)
    const newBalance = (walletData.balance || 0) + 5
    await supabase.from('coin_wallets').update({ balance: newBalance }).eq('user_id', userId)
    await supabase.from('coin_transactions').insert({
      user_id: userId, type: 'bonus', amount: 5,
      description: 'Daily login bonus', balance_after: newBalance,
    })
    setWallet(prev => ({ ...prev, balance: newBalance }))
    setDailyClaimed(true)
    setMessage('🎉 You earned 5 coins for your daily login!')
    setTimeout(() => setMessage(''), 4000)
  }

  const likeUser = (userId) => {
    if (likedUsers.includes(userId)) {
      setLikedUsers(prev => prev.filter(id => id !== userId))
    } else {
      setLikedUsers(prev => [...prev, userId])
      setMessage('❤️ Liked!')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <div className="text-pink-500 text-xl font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pink-50">

      {/* Top Navigation */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Profile Icon Top Left */}
          <a href="/profile" className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-pink-200 flex items-center justify-center">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>
          </a>
          <div>
            <div className="font-bold text-gray-800 text-sm">
              @{profile?.username || 'User'}
            </div>
            <div className="text-gray-400 text-xs">
              {getFlag(profile?.location)} {profile?.location || 'No location'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingRequests > 0 && (
            <a href="/notifications" className="relative">
              <span className="text-2xl">🔔</span>
              <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {pendingRequests}
              </span>
            </a>
          )}
          <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1">
            <span>🪙</span>
            <span className="font-bold text-yellow-600">{wallet?.balance || 0}</span>
          </div>
          <button onClick={handleLogout} className="text-gray-400 text-xs">
            Exit
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="mx-4 mt-3 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Daily Bonus */}
      {!dailyClaimed && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 mx-4 mt-4 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">📅 Daily Login Bonus</p>
            <p className="text-white text-xs opacity-80">Claim your 5 free coins!</p>
          </div>
          <div className="bg-white text-yellow-500 px-3 py-1 rounded-full font-bold text-sm">
            +5 🪙
          </div>
        </div>
      )}

      {/* Quick Nav */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1">
        <a href="/browse" className="flex-shrink-0 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2 text-sm font-semibold text-gray-700">
          🔍 Browse
        </a>
        <a href="/chat" className="flex-shrink-0 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2 text-sm font-semibold text-gray-700">
          💬 Chats
        </a>
        <a href="/gifts" className="flex-shrink-0 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2 text-sm font-semibold text-gray-700">
          🎁 Gifts
        </a>
        <a href="/coins" className="flex-shrink-0 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2 text-sm font-semibold text-gray-700">
          🪙 Coins
        </a>
        <a href="/notifications" className="flex-shrink-0 bg-white rounded-2xl px-4 py-2 shadow-sm flex items-center gap-2 text-sm font-semibold text-gray-700">
          🔔 Requests
        </a>
      </div>

      {/* Free Stats Bar */}
      <div className="mx-4 mt-4 bg-white rounded-2xl p-3 shadow-sm flex justify-around text-center">
        <div>
          <div className="text-pink-500 font-bold">{profile?.free_messages_remaining || 0}</div>
          <div className="text-gray-400 text-xs">💬 Messages</div>
        </div>
        <div>
          <div className="text-green-500 font-bold">{profile?.free_audio_calls_remaining || 0}</div>
          <div className="text-gray-400 text-xs">📞 Calls</div>
        </div>
        <div>
          <div className="text-blue-500 font-bold">{profile?.free_video_calls_remaining || 0}</div>
          <div className="text-gray-400 text-xs">📹 Video</div>
        </div>
        <div>
          <div className="text-yellow-500 font-bold">{wallet?.balance || 0}</div>
          <div className="text-gray-400 text-xs">🪙 Coins</div>
        </div>
      </div>

      {/* Discover People */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-lg">✨ Discover People</h2>
          <a href="/browse" className="text-pink-500 text-sm font-semibold">See all →</a>
        </div>

        {nearbyUsers.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <div className="text-5xl mb-2">👥</div>
            <p>No users yet. Invite friends!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {nearbyUsers.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

                {/* Photo */}
                <div className="h-40 bg-gradient-to-br from-pink-200 to-red-200 flex items-center justify-center relative">
                  {u.profile_photo ? (
                    <img src={u.profile_photo} alt={u.username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-6xl">
                      {u.gender === 'male' ? '👨' : u.gender === 'female' ? '👩' : '🧑'}
                    </span>
                  )}
                  {/* Flag badge */}
                  <div className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow">
                    {getFlag(u.location)}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-800 text-sm">@{u.username}</span>
                    {u.age && <span className="text-gray-400 text-xs">• {u.age}</span>}
                  </div>
                  {u.location && (
                    <p className="text-gray-400 text-xs mt-0.5">
                      {getFlag(u.location)} {u.location}
                    </p>
                  )}
                  {u.looking_for && (
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold ${
                      u.looking_for === 'dating' ? 'bg-red-100 text-red-500' :
                      u.looking_for === 'friendship' ? 'bg-blue-100 text-blue-500' :
                      'bg-purple-100 text-purple-500'
                    }`}>
                      {u.looking_for}
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => likeUser(u.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        likedUsers.includes(u.id)
                          ? 'bg-pink-500 text-white'
                          : 'bg-pink-50 text-pink-500'
                      }`}
                    >
                      {likedUsers.includes(u.id) ? '❤️' : '🤍'} Like
                    </button>
                    <a
                      href={`/gifts?to=${u.id}&name=${u.username}`}
                      className="flex-1 bg-yellow-50 text-yellow-600 text-xs py-1.5 rounded-lg font-bold text-center"
                    >
                      🎁 Gift
                    </a>
                  </div>
                  <a
                    href={`/chat`}
                    className="block w-full bg-pink-500 text-white text-xs py-1.5 rounded-lg font-bold text-center mt-1"
                  >
                    💬 Chat
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Referral Card */}
      <div className="bg-white mx-4 mt-4 mb-6 rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-1">🔗 Refer & Earn</h2>
        <p className="text-gray-400 text-sm mb-2">
          Earn <span className="text-pink-500 font-bold">50 coins</span> for every friend who joins!
        </p>
        <div className="bg-pink-50 rounded-xl p-3 flex items-center justify-between">
          <span className="font-bold text-pink-500">{profile?.referral_code || 'LOADING'}</span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://my-dating-app-eight.vercel.app?ref=${profile?.referral_code}`)
              setMessage('✅ Referral link copied!')
              setTimeout(() => setMessage(''), 3000)
            }}
            className="bg-pink-500 text-white px-3 py-1 rounded-lg text-sm font-bold"
          >
            Share
          </button>
        </div>
      </div>

    </div>
  )
}