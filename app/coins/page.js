'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CoinsPage() {
  const [user, setUser] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [packages, setPackages] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)

    const { data: wallet } = await supabase
      .from('coin_wallets')
      .select('*')
      .eq('user_id', user.id)
      .single()
    setWallet(wallet)

    const { data: packages } = await supabase
      .from('coin_packages')
      .select('*')
      .eq('is_active', true)
      .order('price_usd', { ascending: true })
    setPackages(packages || [])

    const { data: transactions } = await supabase
      .from('coin_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setTransactions(transactions || [])

    setLoading(false)
  }

  const buyPackage = async (pkg) => {
    setMessage('Redirecting to payment...')
    const { data: { user } } = await supabase.auth.getUser()

    const response = await fetch('/api/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: pkg.id,
        coins: pkg.coins + pkg.bonus_coins,
        price: pkg.price_usd,
        packageName: pkg.name,
        userId: user.id,
      }),
    })

    const { url, error } = await response.json()
    if (error) {
      setMessage('Error: ' + error)
    } else {
      window.location.href = url
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
        <h1 className="font-bold text-gray-800 text-lg">Buy Coins</h1>
      </div>

      {/* Wallet Balance */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 mx-4 mt-4 rounded-2xl p-5 text-white text-center">
        <div className="text-5xl">🪙</div>
        <div className="text-4xl font-bold mt-2">{wallet?.balance || 0}</div>
        <div className="opacity-80 mt-1">Your Coin Balance</div>
        <div className="flex justify-center gap-6 mt-3 text-sm opacity-90">
          <div>
            <div className="font-bold">{wallet?.total_purchased || 0}</div>
            <div>Total Bought</div>
          </div>
          <div>
            <div className="font-bold">{wallet?.total_spent || 0}</div>
            <div>Total Spent</div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="mx-4 mt-3 bg-blue-100 text-blue-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Coin Packages */}
      <div className="px-4 mt-4">
        <h2 className="font-bold text-gray-800 text-lg mb-3">Choose a Package</h2>
        <div className="space-y-3">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between ${
                pkg.is_popular ? 'border-2 border-pink-400' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 w-12 h-12 rounded-xl flex items-center justify-center text-2xl">
                  🪙
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{pkg.name}</span>
                    {pkg.is_popular && (
                      <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500 text-sm">
                    {pkg.coins} coins
                    {pkg.bonus_coins > 0 && (
                      <span className="text-green-500 font-semibold"> + {pkg.bonus_coins} bonus</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => buyPackage(pkg)}
                className={`px-4 py-2 rounded-xl font-bold text-sm ${
                  pkg.is_popular
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                ${pkg.price_usd}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* How to earn free coins */}
      <div className="mx-4 mt-6 bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-gray-800 mb-3">🎁 Earn Free Coins</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-2xl">👥</span>
            <div>
              <div className="font-semibold text-gray-700">Refer a Friend</div>
              <div className="text-gray-400">Earn 50 coins per referral</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-2xl">📅</span>
            <div>
              <div className="font-semibold text-gray-700">Daily Login</div>
              <div className="text-gray-400">Earn 5 coins every day</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-2xl">✅</span>
            <div>
              <div className="font-semibold text-gray-700">Complete Profile</div>
              <div className="text-gray-400">Earn 20 coins</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="mx-4 mt-6">
          <h2 className="font-bold text-gray-800 mb-3">Transaction History</h2>
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-700 text-sm">{tx.description}</div>
                  <div className="text-gray-400 text-xs">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className={`font-bold ${tx.type === 'spent' ? 'text-red-500' : 'text-green-500'}`}>
                  {tx.type === 'spent' ? '-' : '+'}{tx.amount} 🪙
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}