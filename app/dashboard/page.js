'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dailyClaimed, setDailyClaimed] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/'
      return
    }
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

    // Check pending requests
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
    setPendingRequests(count || 0)

    // Check if daily bonus already claimed
    const today = new Date().toISOString().split('T')[0]
    if (profile?.last_daily_bonus === today) {
      setDailyClaimed(true)
    } else {
      // Auto claim daily bonus
      claimDailyBonus(user.id, profile, wallet)
    }

    setLoading(false)
  }

  const claimDailyBonus = async (userId, profileData, walletData) => {
    const today = new Date().toISOString().split('T')[0]
    if (!profileData || !walletData) return
    if (profileData.last_daily_bonus === today) {
      setDailyClaimed(true)
      return
    }

    await supabase
      .from('profiles')
      .update({ last_daily_bonus: today })
      .eq('id', userId)

    const newBalance = (walletData.balance || 0) + 5

    await supabase
      .from('coin_wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId)

    await supabase.from('coin_transactions').insert({
      user_id: userId,
      type: 'bonus',
      amount: 5,
      description: 'Daily login bonus',
      balance_after: newBalance,
    })

    setWallet(prev => ({ ...prev, balance: newBalance }))
    setDailyClaimed(true)
    setMessage('🎉 You earned 5 coins for your daily login!')
    setTimeout(() => setMessage(''), 4000)
  }

  const copyReferralCode = () => {
    const referralLink = `https://my-dating-app-eight.vercel.app?ref=${profile?.referral_code}`
    navigator.clipboard.writeText(referralLink)
    setMessage('✅ Referral link copied! Share it to earn 50 coins per friend!')
    setTimeout(() => setMessage(''), 4000)
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
        <div className="flex items-center gap-2">
          <span className="text-2xl">💝</span>
          <span className="font-bold text-pink-500 text-lg">HeartLink</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1">
            <span>🪙</span>
            <span className="font-bold text-yellow-600">{wallet?.balance || 0}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-gray-400 text-sm hover:text-red-400"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="mx-4 mt-3 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-pink-500 to-red-400 text-white p-6 mx-4 mt-4 rounded-2xl">
        <h1 className="text-2xl font-bold">Welcome back! 👋</h1>
        <p className="opacity-80 mt-1">{profile?.username || user?.email}</p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-white bg-opacity-20 rounded-xl p-3">
            <p className="text-xs opacity-80">💬 Free Messages</p>
            <p className="text-2xl font-bold">{profile?.free_messages_remaining || 0}</p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-xl p-3">
            <p className="text-xs opacity-80">🪙 Coins</p>
            <p className="text-2xl font-bold">{wallet?.balance || 0}</p>
          </div>
        </div>
      </div>

      {/* Daily Bonus Card */}
      <div className={`mx-4 mt-4 rounded-2xl p-4 shadow-sm ${
        dailyClaimed ? 'bg-gray-100' : 'bg-gradient-to-r from-yellow-400 to-orange-400'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`font-bold ${dailyClaimed ? 'text-gray-500' : 'text-white'}`}>
              📅 Daily Login Bonus
            </h2>
            <p className={`text-sm ${dailyClaimed ? 'text-gray-400' : 'text-white opacity-80'}`}>
              {dailyClaimed ? 'Come back tomorrow for 5 more coins!' : 'Claim your 5 free coins!'}
            </p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-bold text-sm ${
            dailyClaimed
              ? 'bg-gray-200 text-gray-400'
              : 'bg-white text-yellow-500'
          }`}>
            {dailyClaimed ? '✓ Claimed' : '+5 🪙'}
          </div>
        </div>
      </div>

      {/* Referral Card */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-1">🔗 Refer & Earn</h2>
        <p className="text-gray-400 text-sm mb-3">
          Share your link — earn <span className="text-pink-500 font-bold">50 coins</span> for every friend who joins!
        </p>
        <div className="bg-pink-50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Your referral code</p>
            <p className="font-bold text-pink-500 text-lg">{profile?.referral_code || 'LOADING'}</p>
          </div>
          <button
            onClick={copyReferralCode}
            className="bg-pink-500 text-white px-3 py-2 rounded-lg text-sm font-bold"
          >
            Share Link
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 px-4 mt-4">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="text-2xl">📞</div>
          <div className="font-bold text-gray-800">{profile?.free_audio_calls_remaining || 0}</div>
          <div className="text-gray-400 text-xs">Free Calls</div>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="text-2xl">📹</div>
          <div className="font-bold text-gray-800">{profile?.free_video_calls_remaining || 0}</div>
          <div className="text-gray-400 text-xs">Free Video</div>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <div className="text-2xl">🎁</div>
          <div className="font-bold text-gray-800">0</div>
          <div className="text-gray-400 text-xs">Gifts</div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-3 pb-6">
        <a href="/browse" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">🔍</span>
          <div>
            <div className="font-bold text-gray-800">Browse</div>
            <div className="text-gray-400 text-xs">Find people</div>
          </div>
        </a>
        <a href="/chat" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">💬</span>
          <div>
            <div className="font-bold text-gray-800">Chats</div>
            <div className="text-gray-400 text-xs">Your messages</div>
          </div>
        </a>
        <a href="/notifications" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition relative">
          <span className="text-3xl">🔔</span>
          <div>
            <div className="font-bold text-gray-800">Requests</div>
            <div className="text-gray-400 text-xs">Friend requests</div>
          </div>
          {pendingRequests > 0 && (
            <span className="absolute top-2 right-2 bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {pendingRequests}
            </span>
          )}
        </a>
        <a href="/gifts" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">🎁</span>
          <div>
            <div className="font-bold text-gray-800">Gifts</div>
            <div className="text-gray-400 text-xs">Send gifts</div>
          </div>
        </a>
        <a href="/coins" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">🪙</span>
          <div>
            <div className="font-bold text-gray-800">Buy Coins</div>
            <div className="text-gray-400 text-xs">Top up wallet</div>
          </div>
        </a>
        <a href="/profile" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">👤</span>
          <div>
            <div className="font-bold text-gray-800">Profile</div>
            <div className="text-gray-400 text-xs">Edit profile</div>
          </div>
        </a>
      </div>

    </div>
  )
}