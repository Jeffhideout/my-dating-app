'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'

function GiftsContent() {
  const searchParams = useSearchParams()
  const receiverId = searchParams.get('to')
  const receiverName = searchParams.get('name')

  const [user, setUser] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [gifts, setGifts] = useState([])
  const [receivedGifts, setReceivedGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [activeTab, setActiveTab] = useState(receiverId ? 'send' : 'received')

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

    const { data: gifts } = await supabase
      .from('gifts')
      .select('*')
      .eq('is_active', true)
      .order('coin_cost', { ascending: true })
    setGifts(gifts || [])

    const { data: received } = await supabase
      .from('sent_gifts')
      .select('*, gifts(*), profiles!sent_gifts_sender_id_fkey(*)')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false })
    setReceivedGifts(received || [])

    setLoading(false)
  }

  const sendGift = async (gift) => {
    if (!receiverId) {
      setMessage('Please select a person to send a gift to from the Browse page!')
      return
    }

    if (wallet.balance < gift.coin_cost) {
      setMessage('Not enough coins! Please buy more coins.')
      return
    }

    setSending(true)
    setMessage('')

    // Insert sent gift
    const { error: giftError } = await supabase
      .from('sent_gifts')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        gift_id: gift.id,
        message: giftMessage,
      })

    if (giftError) {
      setMessage('Error sending gift: ' + giftError.message)
      setSending(false)
      return
    }

    // Deduct coins from wallet
    await supabase
      .from('coin_wallets')
      .update({
        balance: wallet.balance - gift.coin_cost,
        total_spent: (wallet.total_spent || 0) + gift.coin_cost
      })
      .eq('user_id', user.id)

    // Log transaction
    await supabase
      .from('coin_transactions')
      .insert({
        user_id: user.id,
        type: 'spent',
        amount: gift.coin_cost,
        description: `Sent ${gift.name} to @${receiverName}`,
        balance_after: wallet.balance - gift.coin_cost,
      })

    // Unlock chat room
    const user1 = user.id < receiverId ? user.id : receiverId
    const user2 = user.id < receiverId ? receiverId : user.id

    const { data: existingRoom } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .single()

    if (!existingRoom) {
      await supabase.from('chat_rooms').insert({
        user1_id: user1,
        user2_id: user2,
        is_unlocked: true,
        unlocked_by: user.id,
        unlocked_at: new Date().toISOString(),
      })
    } else if (!existingRoom.is_unlocked) {
      await supabase
        .from('chat_rooms')
        .update({ is_unlocked: true, unlocked_by: user.id, unlocked_at: new Date().toISOString() })
        .eq('id', existingRoom.id)
    }

    // Send notification
    await supabase.from('notifications').insert({
      user_id: receiverId,
      type: 'gift_received',
      title: 'You received a gift!',
      body: `Someone sent you a ${gift.name} ${gift.icon}`,
    })

    setWallet(prev => ({ ...prev, balance: prev.balance - gift.coin_cost }))
    setMessage(`${gift.icon} ${gift.name} sent to @${receiverName}! Chat is now unlocked! 🎉`)
    setGiftMessage('')
    setSending(false)
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
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 text-2xl">←</a>
          <h1 className="font-bold text-gray-800 text-lg">Gifts</h1>
        </div>
        <div className="bg-yellow-100 px-3 py-1 rounded-full flex items-center gap-1">
          <span>🪙</span>
          <span className="font-bold text-yellow-600">{wallet?.balance || 0}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white mx-4 mt-4 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'send' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          🎁 Send Gift
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'received' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          💝 Received
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-3 text-sm text-center py-2 rounded-xl font-semibold ${
          message.includes('Error') || message.includes('enough') || message.includes('select')
            ? 'bg-red-100 text-red-600'
            : 'bg-green-100 text-green-600'
        }`}>
          {message}
        </div>
      )}

      {/* Send Gift Tab */}
      {activeTab === 'send' && (
        <div className="px-4 mt-4">
          {receiverId ? (
            <div className="bg-pink-100 rounded-2xl p-3 mb-4 text-center">
              <p className="text-pink-600 font-semibold">
                Sending gift to <span className="font-bold">@{receiverName}</span>
              </p>
              <p className="text-pink-400 text-xs mt-1">
                Sending a gift will unlock your chat! 💬
              </p>
            </div>
          ) : (
            <div className="bg-yellow-100 rounded-2xl p-3 mb-4 text-center">
              <p className="text-yellow-600 text-sm font-semibold">
                Go to Browse to select someone to send a gift to!
              </p>
            </div>
          )}

          {/* Gift Message */}
          <input
            type="text"
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="Add a message with your gift (optional)"
            className="w-full bg-white rounded-2xl px-4 py-3 text-sm focus:outline-none shadow-sm mb-4"
          />

          {/* Gifts Grid */}
          {['flowers', 'fun', 'jewelry', 'premium'].map(category => (
            <div key={category} className="mb-4">
              <h3 className="font-bold text-gray-600 capitalize mb-2">{category}</h3>
              <div className="grid grid-cols-2 gap-3">
                {gifts.filter(g => g.category === category).map(gift => (
                  <div key={gift.id} className="bg-white rounded-2xl p-3 shadow-sm">
                    <div className="text-4xl text-center mb-2">{gift.icon}</div>
                    <div className="font-bold text-gray-800 text-sm text-center">{gift.name}</div>
                    <div className="text-gray-400 text-xs text-center mb-2">{gift.description}</div>
                    <button
                      onClick={() => sendGift(gift)}
                      disabled={sending || !receiverId}
                      className={`w-full py-2 rounded-xl text-sm font-bold transition-all ${
                        wallet?.balance >= gift.coin_cost
                          ? 'bg-pink-500 text-white hover:opacity-90'
                          : 'bg-gray-100 text-gray-400'
                      } disabled:opacity-50`}
                    >
                      🪙 {gift.coin_cost} coins
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Received Gifts Tab */}
      {activeTab === 'received' && (
        <div className="px-4 mt-4">
          {receivedGifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20">
              <div className="text-6xl">🎁</div>
              <p className="text-gray-400 mt-3">No gifts received yet</p>
              <p className="text-gray-300 text-sm">Share your profile to receive gifts!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receivedGifts.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="text-4xl">{item.gifts?.icon}</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">{item.gifts?.name}</div>
                    <div className="text-gray-400 text-sm">
                      From @{item.profiles?.username}
                    </div>
                    {item.message && (
                      <div className="text-gray-500 text-xs mt-1 italic">"{item.message}"</div>
                    )}
                    <div className="text-gray-300 text-xs mt-1">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GiftsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-pink-50 flex items-center justify-center"><div className="text-pink-500 text-xl font-bold">Loading...</div></div>}>
      <GiftsContent />
    </Suspense>
  )
}