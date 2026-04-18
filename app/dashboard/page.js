'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)

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

    // Get pending requests count
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
    setPendingRequests(count || 0)

    setLoading(false)
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

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-pink-500 to-red-400 text-white p-6 mx-4 mt-4 rounded-2xl">
        <h1 className="text-2xl font-bold">
          Welcome back! 👋
        </h1>
        <p className="opacity-80 mt-1">
          {profile?.username || user?.email}
        </p>
        <div className="mt-3 bg-white bg-opacity-20 rounded-xl p-3">
          <p className="text-sm">💬 Free messages remaining:</p>
          <p className="text-3xl font-bold">{profile?.free_messages_remaining || 0}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 px-4 mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <div className="text-3xl">🪙</div>
          <div className="font-bold text-2xl text-gray-800 mt-1">{wallet?.balance || 0}</div>
          <div className="text-gray-400 text-sm">Coins</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <div className="text-3xl">🎁</div>
          <div className="font-bold text-2xl text-gray-800 mt-1">0</div>
          <div className="text-gray-400 text-sm">Gifts Received</div>
        </div>
      </div>

      {/* Referral Card */}
      <div className="bg-white mx-4 mt-4 rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-1">🔗 Your Referral Code</h2>
        <p className="text-gray-400 text-sm mb-2">Share and earn 50 coins per friend!</p>
        <div className="bg-pink-50 rounded-xl p-3 flex items-center justify-between">
          <span className="font-bold text-pink-500 text-lg">
            {profile?.referral_code || 'LOADING'}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(profile?.referral_code || '')
              alert('Referral code copied!')
            }}
            className="bg-pink-500 text-white px-3 py-1 rounded-lg text-sm"
          >
            Copy
          </button>
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
        <a href="/admin" className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition">
          <span className="text-3xl">⚙️</span>
          <div>
            <div className="font-bold text-gray-800">Admin</div>
            <div className="text-gray-400 text-xs">Manage app</div>
          </div>
        </a>
      </div>

    </div>
  )
}