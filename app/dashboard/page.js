'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COUNTRY_FLAGS = {
  'kenya': '🇰🇪', 'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'uganda': '🇺🇬',
  'tanzania': '🇹🇿', 'south africa': '🇿🇦', 'ethiopia': '🇪🇹',
  'usa': '🇺🇸', 'uk': '🇬🇧', 'canada': '🇨🇦', 'australia': '🇦🇺',
  'india': '🇮🇳', 'germany': '🇩🇪', 'france': '🇫🇷', 'brazil': '🇧🇷',
  'nairobi': '🇰🇪', 'lagos': '🇳🇬', 'accra': '🇬🇭', 'kampala': '🇺🇬',
  'mombasa': '🇰🇪', 'kisumu': '🇰🇪', 'nakuru': '🇰🇪', 'eldoret': '🇰🇪',
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
  const [message, setMessage] = useState('')
  const [nearbyUsers, setNearbyUsers] = useState([])
  const [likedUsers, setLikedUsers] = useState([])
  const [activeTab, setActiveTab] = useState('forYou')

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

    // Redirect to profile if not complete
    if (!profile?.full_name || !profile?.profile_photo) {
      window.location.href = '/profile'
      return
    }

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

    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .eq('is_banned', false)
      .not('profile_photo', 'is', null)
      .limit(30)
    setNearbyUsers(users || [])

    // Daily bonus
    const today = new Date().toISOString().split('T')[0]
    if (profile?.last_daily_bonus !== today) {
      claimDailyBonus(user.id, profile, wallet)
    }

    setLoading(false)
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
    setMessage('🎉 +5 coins daily bonus!')
    setTimeout(() => setMessage(''), 3000)
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-pink-500 text-xl font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Navigation */}
      <div className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Profile Icon Top Left */}
          <a href="/profile" className="relative">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-pink-200 flex items-center justify-center border-2 border-pink-400">
              {profile?.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">👤</span>
              )}
            </div>
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
          {pendingRequests > 0 && (
            <a href="/notifications" className="relative">
              <span className="text-2xl">🔔</span>
              <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {pendingRequests}
              </span>
            </a>
          )}
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
        <button
          onClick={() => setActiveTab('forYou')}
          className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'forYou' ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400'
          }`}
        >
          For You
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'nearby' ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400'
          }`}
        >
          Nearby
        </button>
        <button
          onClick={() => setActiveTab('dating')}
          className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'dating' ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400'
          }`}
        >
          Dating
        </button>
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'friends' ? 'border-pink-500 text-pink-500' : 'border-transparent text-gray-400'
          }`}
        >
          Friends
        </button>
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
                setMessage('✅ Invite link copied!')
              }}
              className="mt-4 bg-pink-500 text-white px-6 py-2 rounded-full font-bold text-sm"
            >
              Invite Friends
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
                  {/* Photo */}
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
                      onClick={() => likeUser(u.id)}
                      className="absolute bottom-1 right-1 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-sm"
                    >
                      {likedUsers.includes(u.id) ? '❤️' : '🤍'}
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <div className="font-bold text-gray-900 text-xs truncate">
                      {u.full_name || u.username}{u.age ? `, ${u.age}` : ''}
                    </div>
                    {u.location && (
                      <div className="text-gray-400 text-xs truncate">{u.location}</div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-1 mt-1.5">
                      <a
                        href={`/gifts?to=${u.id}&name=${u.full_name || u.username}`}
                        className="flex-1 bg-yellow-50 text-yellow-600 text-xs py-1 rounded-lg font-bold text-center"
                      >
                        🎁
                      </a>
                      <a
                        href="/chat"
                        className="flex-1 bg-pink-500 text-white text-xs py-1 rounded-lg font-bold text-center"
                      >
                        💬
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-around">
        <a href="/chat" className="flex flex-col items-center gap-0.5 relative">
          <span className="text-2xl">💬</span>
          <span className="text-xs text-gray-400 font-semibold">Chats</span>
        </a>
        <a href="/notifications" className="flex flex-col items-center gap-0.5 relative">
          <span className="text-2xl">🔔</span>
          {pendingRequests > 0 && (
            <span className="absolute -top-1 right-0 bg-pink-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {pendingRequests}
            </span>
          )}
          <span className="text-xs text-gray-400 font-semibold">Requests</span>
        </a>
        <a href="/gifts" className="flex flex-col items-center gap-0.5">
          <span className="text-2xl">🎁</span>
          <span className="text-xs text-gray-400 font-semibold">Gifts</span>
        </a>
        <a href="/profile" className="flex flex-col items-center gap-0.5">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-pink-200 flex items-center justify-center">
            {profile?.profile_photo ? (
              <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">👤</span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-semibold">Profile</span>
        </a>
      </div>

    </div>
  )
}