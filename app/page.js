'use client'
import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setMessage('')
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

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    // Check if username is taken
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

    // Sign up
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Create profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        free_messages_remaining: 20,
        free_audio_calls_remaining: 3,
        free_video_calls_remaining: 2,
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      })

      // Create coin wallet with welcome bonus
      await supabase.from('coin_wallets').insert({
        user_id: data.user.id,
        balance: 50,
        total_purchased: 0,
        total_spent: 0,
      })

      setMessage('Account created! Setting up your profile...')
      setTimeout(() => window.location.href = '/profile', 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-400 to-orange-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">💝</div>
          <h1 className="text-3xl font-bold text-gray-800">HeartLink</h1>
          <p className="text-gray-500 text-sm mt-1">Friendship & Dating App</p>
        </div>

        {/* Toggle */}
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

        {/* Form */}
        <div className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username (no spaces)"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400"
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400"
          />

          {message && (
            <p className={`text-sm text-center font-semibold ${
              message.includes('success') || message.includes('created') || message.includes('Setting')
                ? 'text-green-500'
                : 'text-red-500'
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

        {/* Welcome bonus */}
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