'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState({
    full_name: '',
    age: '',
    gender: '',
    looking_for: '',
    bio: '',
    location: '',
    interests: [],
  })

  const interestOptions = [
    'Music', 'Travel', 'Gaming', 'Cooking', 'Fitness',
    'Movies', 'Reading', 'Art', 'Sports', 'Photography',
    'Dancing', 'Hiking', 'Fashion', 'Technology', 'Food'
  ]

  useEffect(() => {
    getProfile()
  }, [])

  const getProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/'; return }
    setUser(user)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile({
        full_name: data.full_name || '',
        age: data.age || '',
        gender: data.gender || '',
        looking_for: data.looking_for || '',
        bio: data.bio || '',
        location: data.location || '',
        interests: data.interests || [],
      })
    }
    setLoading(false)
  }

  const toggleInterest = (interest) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }))
  }

  const saveProfile = async () => {
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        age: parseInt(profile.age),
        gender: profile.gender,
        looking_for: profile.looking_for,
        bio: profile.bio,
        location: profile.location,
        interests: profile.interests,
      })
      .eq('id', user.id)

    if (error) {
      setMessage('Error saving profile: ' + error.message)
    } else {
      setMessage('Profile saved successfully!')
      setTimeout(() => window.location.href = '/dashboard', 1500)
    }
    setSaving(false)
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
        <h1 className="font-bold text-gray-800 text-lg">Edit Profile</h1>
      </div>

      {/* Profile Photo */}
      <div className="flex flex-col items-center mt-6">
        <div className="w-24 h-24 bg-pink-200 rounded-full flex items-center justify-center text-5xl">
          👤
        </div>
        <button className="mt-2 text-pink-500 text-sm font-semibold">
          Change Photo
        </button>
      </div>

      {/* Form */}
      <div className="px-4 mt-6 space-y-4">

        {/* Full Name */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Full Name</label>
          <input
            type="text"
            value={profile.full_name}
            onChange={(e) => setProfile({...profile, full_name: e.target.value})}
            placeholder="Enter your full name"
            className="w-full mt-1 border-b border-gray-100 py-2 focus:outline-none text-gray-800"
          />
        </div>

        {/* Age */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Age</label>
          <input
            type="number"
            value={profile.age}
            onChange={(e) => setProfile({...profile, age: e.target.value})}
            placeholder="Your age (18+)"
            min="18"
            className="w-full mt-1 border-b border-gray-100 py-2 focus:outline-none text-gray-800"
          />
        </div>

        {/* Gender */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Gender</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {['male', 'female', 'non-binary', 'other'].map(g => (
              <button
                key={g}
                onClick={() => setProfile({...profile, gender: g})}
                className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                  profile.gender === g
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Looking For */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Looking For</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {['friendship', 'dating', 'both'].map(l => (
              <button
                key={l}
                onClick={() => setProfile({...profile, looking_for: l})}
                className={`px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                  profile.looking_for === l
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Location</label>
          <input
            type="text"
            value={profile.location}
            onChange={(e) => setProfile({...profile, location: e.target.value})}
            placeholder="e.g. Nairobi, Kenya"
            className="w-full mt-1 border-b border-gray-100 py-2 focus:outline-none text-gray-800"
          />
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile({...profile, bio: e.target.value})}
            placeholder="Tell people about yourself..."
            rows={3}
            className="w-full mt-1 border-b border-gray-100 py-2 focus:outline-none text-gray-800 resize-none"
          />
        </div>

        {/* Interests */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="text-gray-500 text-sm font-semibold">
            Interests ({profile.interests.length} selected)
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {interestOptions.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                  profile.interests.includes(interest)
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        {message && (
          <p className={`text-center text-sm font-semibold ${
            message.includes('success') ? 'text-green-500' : 'text-red-500'
          }`}>
            {message}
          </p>
        )}

        {/* Save Button */}
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-gradient-to-r from-pink-500 to-red-400 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>

      </div>
    </div>
  )
}