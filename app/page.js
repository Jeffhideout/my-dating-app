'use client'
import { useState } from 'react'
import { supabase } from '../app/lib/supabase'

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

    // Create profile
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        free_messages_remaining: 20,
        referral_code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      })

      // Create coin wallet
      await supabase.from('coin_wallets').insert({
        user_id: data.user.id,
        balance: 50, // welcome bonus coins
      })

      setMessage('Account created! Please check your email to verify.')
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
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              isLogin ? 'bg-pink-500 text-white shadow' : 'text-gray-500'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setIsLogin(false)}
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
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-pink-400"
          />

          {message && (
            <p className={`text-sm text-center ${message.includes('success') || message.includes('created') ? 'text-green-500' : 'text-red-500'}`}>
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
            <p className="text-pink-600 text-sm font-semibold">🎁 Welcome Bonus: 50 free coins + 20 free messages!</p>
          </div>
        )}

        <p className="text-center text-gray-400 text-xs mt-6">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  )
}