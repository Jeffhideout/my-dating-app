'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('user_id')
  const coins = parseInt(searchParams.get('coins') || '0')
  const sessionId = searchParams.get('session_id')
  const [processed, setProcessed] = useState(false)
  const [message, setMessage] = useState('Processing your payment...')

  useEffect(() => {
    if (!processed && userId && coins) {
      processPayment()
    }
  }, [])

  const processPayment = async () => {
    // Get current wallet
    const { data: wallet } = await supabase
      .from('coin_wallets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!wallet) {
      setMessage('Error finding wallet. Please contact support.')
      return
    }

    const newBalance = wallet.balance + coins

    // Update wallet
    await supabase
      .from('coin_wallets')
      .update({
        balance: newBalance,
        total_purchased: (wallet.total_purchased || 0) + coins,
      })
      .eq('user_id', userId)

    // Log transaction
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      type: 'purchase',
      amount: coins,
      description: `Purchased ${coins} coins`,
      stripe_payment_id: sessionId,
      balance_after: newBalance,
    })

    // Send notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'coin_purchase',
      title: 'Coins Added!',
      body: `${coins} coins have been added to your wallet!`,
    })

    setProcessed(true)
    setMessage(`Successfully added ${coins} coins to your wallet!`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="text-7xl mb-4">
          {processed ? '🎉' : '⏳'}
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {processed ? 'Payment Successful!' : 'Processing...'}
        </h1>
        <p className="text-gray-500 mb-6">{message}</p>

        {processed && (
          <>
            <div className="bg-yellow-50 rounded-2xl p-4 mb-6">
              <div className="text-4xl">🪙</div>
              <div className="text-3xl font-bold text-yellow-600 mt-1">+{coins} Coins</div>
              <div className="text-gray-400 text-sm">Added to your wallet</div>
            </div>
            <a
              href="/dashboard"
              className="block w-full bg-gradient-to-r from-pink-500 to-red-400 text-white py-3 rounded-2xl font-bold text-lg"
            >
              Go to Dashboard
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-green-400 flex items-center justify-center">
        <div className="text-white text-xl font-bold">Processing...</div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  )
}