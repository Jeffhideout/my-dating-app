'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'

function CallContent() {
  const searchParams = useSearchParams()
  const receiverId = searchParams.get('to')
  const receiverName = searchParams.get('name')
  const callType = searchParams.get('type') || 'video'

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [callStarted, setCallStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roomName, setRoomName] = useState('')

  const AUDIO_CALL_COST = 10
  const VIDEO_CALL_COST = 20
  const FREE_AUDIO_CALLS = 3
  const FREE_VIDEO_CALLS = 2

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

    // Generate unique room name
    const room = `heartlink-${[user.id, receiverId].sort().join('-').substring(0, 30)}`
    setRoomName(room)

    setLoading(false)
  }

  const startCall = async () => {
    const cost = callType === 'video' ? VIDEO_CALL_COST : AUDIO_CALL_COST
    const freeCallsKey = callType === 'video' ? 'free_video_calls_remaining' : 'free_audio_calls_remaining'
    const freeCalls = profile?.[freeCallsKey] || 0

    // Check free calls first
    if (freeCalls > 0) {
      // Use free call
      await supabase
        .from('profiles')
        .update({ [freeCallsKey]: freeCalls - 1 })
        .eq('id', user.id)
      setCallStarted(true)
      loadJitsi()
      return
    }

    // Check coins
    if (wallet.balance < cost) {
      setError(`Not enough coins! You need ${cost} coins for this call. Please buy more coins.`)
      return
    }

    // Deduct coins
    await supabase
      .from('coin_wallets')
      .update({
        balance: wallet.balance - cost,
        total_spent: (wallet.total_spent || 0) + cost
      })
      .eq('user_id', user.id)

    // Log transaction
    await supabase.from('coin_transactions').insert({
      user_id: user.id,
      type: 'spent',
      amount: cost,
      description: `${callType === 'video' ? 'Video' : 'Audio'} call with @${receiverName}`,
      balance_after: wallet.balance - cost,
    })

    // Save call record
    await supabase.from('calls').insert({
      caller_id: user.id,
      receiver_id: receiverId,
      type: callType,
      room_name: roomName,
      coins_spent: cost,
      status: 'started',
    }).select()

    setWallet(prev => ({ ...prev, balance: prev.balance - cost }))
    setCallStarted(true)
    loadJitsi()
  }

  const loadJitsi = () => {
    const script = document.createElement('script')
    script.src = 'https://meet.jit.si/external_api.js'
    script.onload = () => initJitsi()
    document.head.appendChild(script)
  }

  const initJitsi = () => {
    const domain = 'meet.jit.si'
    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: document.getElementById('jitsi-container'),
      userInfo: {
        displayName: profile?.username || 'User',
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: callType === 'audio',
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: callType === 'audio'
          ? ['microphone', 'hangup', 'chat']
          : ['microphone', 'camera', 'hangup', 'chat', 'tileview'],
      },
    }
    new window.JitsiMeetExternalAPI(domain, options)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    )
  }

  // Active call screen
  if (callStarted) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{callType === 'video' ? '📹' : '📞'}</span>
            <span className="text-white font-bold">
              {callType === 'video' ? 'Video' : 'Audio'} Call with @{receiverName}
            </span>
          </div>
          <a
            href="/chat"
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold"
          >
            End Call
          </a>
        </div>
        <div id="jitsi-container" className="flex-1" style={{ minHeight: '80vh' }} />
      </div>
    )
  }

  // Pre-call screen
  const cost = callType === 'video' ? VIDEO_CALL_COST : AUDIO_CALL_COST
  const freeCallsKey = callType === 'video' ? 'free_video_calls_remaining' : 'free_audio_calls_remaining'
  const freeCalls = profile?.[freeCallsKey] || 0

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-3xl p-8 w-full max-w-md text-center">

        {/* Avatar */}
        <div className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-4">
          👤
        </div>

        <h2 className="text-white text-2xl font-bold">@{receiverName}</h2>
        <p className="text-gray-400 mt-1">
          {callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
        </p>

        {/* Free calls info */}
        {freeCalls > 0 ? (
          <div className="bg-green-900 rounded-2xl p-3 mt-4">
            <p className="text-green-400 font-semibold text-sm">
              🎁 You have {freeCalls} free {callType} call{freeCalls > 1 ? 's' : ''} remaining!
            </p>
          </div>
        ) : (
          <div className="bg-gray-700 rounded-2xl p-3 mt-4">
            <p className="text-gray-300 text-sm">
              This call costs <span className="text-yellow-400 font-bold">🪙 {cost} coins</span>
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Your balance: 🪙 {wallet?.balance || 0} coins
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900 rounded-2xl p-3 mt-4">
            <p className="text-red-400 text-sm">{error}</p>
            <a href="/coins" className="text-yellow-400 text-sm font-bold underline">
              Buy Coins →
            </a>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <a
            href="/chat"
            className="flex-1 bg-gray-600 text-white py-3 rounded-2xl font-bold"
          >
            Cancel
          </a>
          <button
            onClick={startCall}
            className={`flex-1 py-3 rounded-2xl font-bold text-white ${
              callType === 'video' ? 'bg-blue-500' : 'bg-green-500'
            }`}
          >
            {callType === 'video' ? '📹 Start Video' : '📞 Start Call'}
          </button>
        </div>

        {/* Switch call type */}
        <a
          href={`/call?to=${receiverId}&name=${receiverName}&type=${callType === 'video' ? 'audio' : 'video'}`}
          className="block mt-4 text-gray-400 text-sm underline"
        >
          Switch to {callType === 'video' ? 'Audio' : 'Video'} Call
        </a>

      </div>
    </div>
  )
}

export default function CallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    }>
      <CallContent />
    </Suspense>
  )
}