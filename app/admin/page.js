'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalGiftsSent: 0,
    totalMessages: 0,
    newUsersToday: 0,
  })
  const [users, setUsers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Total gifts sent
    const { count: totalGiftsSent } = await supabase
      .from('sent_gifts')
      .select('*', { count: 'exact', head: true })

    // Total messages
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })

    // Total transactions
    const { data: txData } = await supabase
      .from('coin_transactions')
      .select('amount, type')
      .eq('type', 'purchase')

    const totalRevenue = txData?.reduce((sum, tx) => sum + tx.amount, 0) || 0
    const totalTransactions = txData?.length || 0

    // New users today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: newUsersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    setStats({
      totalUsers: totalUsers || 0,
      totalTransactions,
      totalRevenue,
      totalGiftsSent: totalGiftsSent || 0,
      totalMessages: totalMessages || 0,
      newUsersToday: newUsersToday || 0,
    })

    // Recent users
    const { data: users } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    setUsers(users || [])

    // Recent transactions
    const { data: transactions } = await supabase
      .from('coin_transactions')
      .select('*, profiles(*)')
      .order('created_at', { ascending: false })
      .limit(20)
    setTransactions(transactions || [])

    setLoading(false)
  }

  const banUser = async (userId, isBanned) => {
    await supabase
      .from('profiles')
      .update({ is_banned: !isBanned })
      .eq('id', userId)
    fetchAdminData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-pink-400 text-xl font-bold">Loading Admin...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-10 text-white">

      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 text-2xl">←</a>
          <div>
            <h1 className="font-bold text-lg">⚙️ Admin Panel</h1>
            <p className="text-gray-400 text-xs">HeartLink Management</p>
          </div>
        </div>
        <div className="bg-green-500 px-3 py-1 rounded-full text-xs font-bold">
          LIVE
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto">
        {['overview', 'users', 'transactions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap transition-all ${
              activeTab === tab ? 'bg-pink-500 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="px-4 mt-4">

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="text-3xl">👥</div>
              <div className="text-3xl font-bold mt-1">{stats.totalUsers}</div>
              <div className="text-gray-400 text-sm">Total Users</div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="text-3xl">🆕</div>
              <div className="text-3xl font-bold mt-1 text-green-400">{stats.newUsersToday}</div>
              <div className="text-gray-400 text-sm">New Today</div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="text-3xl">🎁</div>
              <div className="text-3xl font-bold mt-1 text-yellow-400">{stats.totalGiftsSent}</div>
              <div className="text-gray-400 text-sm">Gifts Sent</div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="text-3xl">💬</div>
              <div className="text-3xl font-bold mt-1 text-blue-400">{stats.totalMessages}</div>
              <div className="text-gray-400 text-sm">Messages Sent</div>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4">
              <div className="text-3xl">💳</div>
              <div className="text-3xl font-bold mt-1 text-purple-400">{stats.totalTransactions}</div>
              <div className="text-gray-400 text-sm">Purchases</div>
            </div>
            <div className="bg-green-900 rounded-2xl p-4 border border-green-500">
              <div className="text-3xl">🪙</div>
              <div className="text-3xl font-bold mt-1 text-green-400">{stats.totalRevenue}</div>
              <div className="text-gray-400 text-sm">Coins Sold</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 bg-gray-800 rounded-2xl p-4">
            <h2 className="font-bold text-gray-300 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <a href="/admin/reports" className="flex items-center gap-3 bg-gray-700 rounded-xl p-3">
                <span className="text-2xl">🚩</span>
                <span className="text-sm font-semibold">View Reports</span>
              </a>
              <a href="/admin/gifts" className="flex items-center gap-3 bg-gray-700 rounded-xl p-3">
                <span className="text-2xl">🎁</span>
                <span className="text-sm font-semibold">Manage Gifts</span>
              </a>
              <a href="/admin/packages" className="flex items-center gap-3 bg-gray-700 rounded-xl p-3">
                <span className="text-2xl">🪙</span>
                <span className="text-sm font-semibold">Manage Coin Packages</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="px-4 mt-4 space-y-2">
          <h2 className="font-bold text-gray-300 mb-2">Recent Users ({stats.totalUsers} total)</h2>
          {users.map(u => (
            <div key={u.id} className="bg-gray-800 rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-900 rounded-full flex items-center justify-center text-xl">
                👤
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">@{u.username}</span>
                  {u.is_banned && (
                    <span className="bg-red-900 text-red-400 text-xs px-2 py-0.5 rounded-full">BANNED</span>
                  )}
                </div>
                <div className="text-gray-400 text-xs">
                  {u.looking_for} • {u.location || 'No location'} • Joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => banUser(u.id, u.is_banned)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold ${
                  u.is_banned ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
                }`}
              >
                {u.is_banned ? 'Unban' : 'Ban'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="px-4 mt-4 space-y-2">
          <h2 className="font-bold text-gray-300 mb-2">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">No transactions yet</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="bg-gray-800 rounded-2xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">@{tx.profiles?.username}</div>
                  <div className="text-gray-400 text-xs">{tx.description}</div>
                  <div className="text-gray-500 text-xs">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <div className={`font-bold ${tx.type === 'purchase' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'purchase' ? '+' : '-'}{tx.amount} 🪙
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  )
}