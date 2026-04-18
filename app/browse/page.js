'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BrowsePage() {
  const [user, setUser] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('both')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)
    fetchProfiles(user.id)
  }

  const fetchProfiles = async (userId) => {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('*')
      .neq('id', userId)
      .eq('is_banned', false)

    if (filter !== 'both') {
      query = query.or(`looking_for.eq.${filter},looking_for.eq.both`)
    }

    const { data } = await query.limit(20)
    setProfiles(data || [])
    setLoading(false)
  }

  const sendRequest = async (receiverId, type) => {
    const { error } = await supabase
      .from('connections')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        type: type,
        status: 'pending'
      })

    if (error) {
      if (error.code === '23505') {
        setMessage('You already sent a request to this person!')
      } else {
        setMessage('Error: ' + error.message)
      }
    } else {
      setMessage('Request sent successfully! 🎉')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="min-h-screen bg-pink-50 pb-10">

      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-gray-400 text-2xl">←</a>
          <h1 className="font-bold text-gray-800 text-lg">Browse People</h1>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 mt-4">
        {['both', 'friendship', 'dating'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); fetchProfiles(user?.id) }}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
              filter === f ? 'bg-pink-500 text-white' : 'bg-white text-gray-500'
            }`}
          >
            {f === 'both' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div className="mx-4 mt-3 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Profiles Grid */}
      {loading ? (
        <div className="flex items-center justify-center mt-20">
          <div className="text-pink-500 text-xl font-bold">Loading...</div>
        </div>
      ) : profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20">
          <div className="text-6xl">😔</div>
          <p className="text-gray-400 mt-3">No people found yet</p>
          <p className="text-gray-300 text-sm">Be the first to invite friends!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4 mt-4">
          {profiles.map(profile => (
            <div key={profile.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

              {/* Photo */}
              <div className="h-36 bg-gradient-to-br from-pink-200 to-red-200 flex items-center justify-center">
                <span className="text-6xl">
                  {profile.gender === 'male' ? '👨' : profile.gender === 'female' ? '👩' : '🧑'}
                </span>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm truncate">
                    {profile.username}
                  </h3>
                  {profile.age && (
                    <span className="text-gray-400 text-xs">{profile.age}</span>
                  )}
                </div>
                {profile.location && (
                  <p className="text-gray-400 text-xs mt-1">📍 {profile.location}</p>
                )}
                {profile.looking_for && (
                  <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block font-semibold ${
                    profile.looking_for === 'dating' ? 'bg-red-100 text-red-500' :
                    profile.looking_for === 'friendship' ? 'bg-blue-100 text-blue-500' :
                    'bg-purple-100 text-purple-500'
                  }`}>
                    {profile.looking_for}
                  </span>
                )}

                {/* Action Buttons */}
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={() => sendRequest(profile.id, 'friendship')}
                    className="flex-1 bg-blue-50 text-blue-500 text-xs py-1.5 rounded-lg font-semibold"
                  >
                    👋 Friend
                  </button>
                  <button
                    onClick={() => sendRequest(profile.id, 'dating')}
                    className="flex-1 bg-pink-50 text-pink-500 text-xs py-1.5 rounded-lg font-semibold"
                  >
                    💝 Date
                  </button>
                </div>

                {/* Gift Button */}
                <a
                  href={`/gifts?to=${profile.id}&name=${profile.username}`}
                  className="block w-full bg-yellow-50 text-yellow-600 text-xs py-1.5 rounded-lg font-semibold text-center mt-1"
                >
                  🎁 Send Gift
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}