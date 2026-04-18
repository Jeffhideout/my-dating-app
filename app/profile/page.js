'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [refCode, setRefCode] = useState('')

  useEffect(() => {
    checkUser()
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setRefCode(ref)
      setIsLogin(false)
    }
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      window.location.href = '/dashboard'
    }
  }

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
    if (!email || !password) {
      setMessage('Please fill in all fields.')
      setLoading(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Login successful! Redirecting...')
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true)
    setMessage('')

    if (!username || !email || !password) {
      setMessage('Please fill in all fields.')
      setLoading(false)
      return
    }
    if (username.length < 3) {
      setMessage('Username must be at least 3 characters.')
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single()

    if (existingUser) {
      setMessage('Username already taken. Please choose another.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        free_messages_remaining: 20,
        free_audio_calls_remaining: 3,
        free_video_calls_remaining: 2,
        referral_code: newReferralCode,
      })

      await supabase.from('coin_wallets').insert({
        user_id: data.user.id,
        balance: 50,
        total_purchased: 0,
        total_spent: 0,
      })

      await supabase.from('coin_transactions').insert({
        user_id: data.user.id,
        type: 'bonus',
        amount: 50,
        description: 'Welcome bonus coins',
        balance_after: 50,
      })

      if (refCode) {
        try {
          await supabase.rpc('handle_referral', {
            new_user_id: data.user.id,
            referral_code: refCode
          })
          setMessage('Account created! Referral bonus applied!')
        } catch (e) {
          setMessage('Account created! Setting up your profile...')
        }
      } else {
        setMessage('Account created! Setting up your profile...')
      }

      setTimeout(() => window.location.href = '/profile', 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-400 to-orange-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-5xl mb-2">💝</div>
          <h1 className="text-3xl font-bold text-gray-800">HeartLink</h1>
          <p className="text-gray-500 text-sm mt-1">Friendship & Dating App</p>
        </div>

        {refCode && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 mb-4 text-center">
            <p className="text-green-600 text-sm font-semibold">
              🎉 You were invited! Register to get <span className="font-bold">50 bonus coins!</span>
            </p>
          </div>
        )}

        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button
            onClick={() => { setIsLogin(true); setMessage('') }}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              isLogin ? 'bg-pink-500 text-white shadow' : 'text-gray-500'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setMessage('') }}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              !isLogin ? 'bg-pink-500 text-white shadow' : 'text-gray-500'
            }`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username (min 3 characters, no spaces)"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 text-gray-800"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 text-gray-800"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 text-gray-800"
          />

          {!isLogin && (
            <input
              type="text"
              placeholder="Referral code (optional)"
              value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400 text-gray-800"
            />
          )}

          {message && (
            <p className={`text-sm text-center font-semibold ${
              message.includes('success') || message.includes('created') || message.includes('Setting') || message.includes('bonus')
                ? 'text-green-500' : 'text-red-500'
            }`}>
              {message}
            </p>
          )}

          <button
            onClick={isLogin ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-red-400 text-white py-3 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
          </button>
        </div>

        {!isLogin && (
          <div className="mt-4 bg-pink-50 rounded-2xl p-3 text-center">
            <p className="text-pink-600 text-sm font-semibold">
              🎁 Welcome Bonus: 50 free coins + 20 free messages!
            </p>
            <p className="text-pink-400 text-xs mt-1">
              📞 3 free audio calls + 📹 2 free video calls
            </p>
          </div>
        )}

        <p className="text-center text-gray-400 text-xs mt-6">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}