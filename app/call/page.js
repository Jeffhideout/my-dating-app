'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
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
  const jitsiContainerRef = useRef(null)
  const jitsiApiRef = useRef(null)

  const AUDIO_CALL_COST = 10
  const VIDEO_CALL_COST = 20

  useEffect(() => {
    getUser()
  }, [])

  useEffect(() => {
    if (callStarted && roomName) {
      loadJitsi()
    }
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose()
      }
    }
  }, [callStarted, roomName])

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

    const ids = [user.id, receiverId].sort()
    const room = `heartlink-${ids[0].substring(0, 8)}-${ids[1].substring(0, 8)}`
    setRoomName(room)
    setLoading(false)
  }

  const loadJitsi = () => {
    const existingScript = document.getElementById('jitsi-script')
    if (existingScript) {
      initJitsi()
      return
    }

    const script = document.createElement('script')
    script.id = 'jitsi-script'
    script.src = 'https://meet.jit.si/external_api.js'
    script.async = true
    script.onload = () => initJitsi()
    script.onerror = () => setError('Failed to load call service. Please check your internet connection.')
    document.head.appendChild(script)
  }

  const initJitsi = () => {
    if (!window.JitsiMeetExternalAPI) {
      setError('Call service not available. Please try again.')
      return
    }

    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose()
    }

    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: profile?.full_name || profile?.username || 'User',
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: callType === 'audio',
        disableDeepLinking: true,
        prejoinPageEnabled: false,
        enableWelcomePage: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        MOBILE_APP_PROMO: false,
        TOOLBAR_BUTTONS: callType === 'audio'
          ? ['microphone', 'hangup', 'chat', 'raisehand']
          : ['microphone', 'camera', 'hangup', 'chat', 'tileview', 'raisehand'],
      },
    }

    try {
      jitsiApiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', options)

      jitsiApiRef.current.addEventListeners({
        readyToClose: () => {
          window.location.href = '/chat'
        },
        videoConferenceLeft: () => {
          window.location.href = '/chat'
        }
      })
    } catch (err) {
      setError('Could not start call: ' + err.message)
    }
  }

  const startCall = async () => {
    const cost = callType === 'video' ? VIDEO_CALL_COST : AUDIO_CALL_COST
    const freeCallsKey = callType === 'video' ? 'free_video_calls_remaining' : 'free_audio_calls_remaining'
    const freeCalls = profile?.[freeCallsKey] || 0

    if (freeCalls > 0) {
      await supabase
        .from('profiles')
        .update({ [freeCallsKey]: freeCalls - 1 })
        .eq('id', user.id)
      setProfile(prev => ({ ...prev, [freeCallsKey]: freeCalls - 1 }))
      setCallStarted(true)
      return
    }

    if (!wallet || wallet.balance < cost) {
      setError(`Not enough coins! You need ${cost} coins for this call.`)
      return
    }

    const newBalance = wallet.balance - cost

    await supabase
      .from('coin_wallets')
      .update({
        balance: newBalance,
        total_spent: (wallet.total_spent || 0) + cost
      })
      .eq('user_id', user.id)

    await supabase.from('coin_transactions').insert({
      user_id: user.id,
      type: 'spent',
      amount: cost,
      description: `${callType === 'video' ? 'Video' : 'Audio'} call with ${receiverName}`,
      balance_after: newBalance,
    })

    setWallet(prev => ({ ...prev, balance: newBalance }))
    setCallStarted(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl font-bold">Loading...</div>
      </div>
    )
  }

  if (callStarted) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{callType === 'video' ? '📹' : '📞'}</span>
            <span className="text-white font-bold text-sm">
              {callType === 'video' ? 'Video' : 'Audio'} Call with {receiverName}
            </span>
          </div>
          <button
            onClick={() => {
              if (jitsiApiRef.current) jitsiApiRef.current.dispose()
              window.location.href = '/chat'
            }}
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold"
          >
            End Call
          </button>
        </div>
        {error && (
          <div className="bg-red-900 text-red-300 p-4 text-center text-sm">
            {error}
          </div>
        )}
        <div
          ref={jitsiContainerRef}
          className="flex-1"
          style={{ minHeight: 'calc(100vh - 60px)' }}
        />
      </div>
    )
  }

  const cost = callType === 'video' ? VIDEO_CALL_COST : AUDIO_CALL_COST
  const freeCallsKey = callType === 'video' ? 'free_video_calls_remaining' : 'free_audio_calls_remaining'
  const freeCalls = profile?.[freeCallsKey] || 0

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-3xl p-8 w-full max-w-md text-center">

        <div className="w-24 h-24 bg-pink-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-4 overflow-hidden">
          <span>👤</span>
        </div>

        <h2 className="text-white text-2xl font-bold">{receiverName}</h2>
        <p className="text-gray-400 mt-1">
          {callType === 'video' ? '📹 Video Call' : '📞 Audio Call'}
        </p>

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

        {error && (
          <div className="bg-red-900 rounded-2xl p-3 mt-4">
            <p className="text-red-400 text-sm">{error}</p>
            <a href="/coins" className="text-yellow-400 text-sm font-bold underline block mt-1">
              Buy Coins →
            </a>
          </div>
        )}

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