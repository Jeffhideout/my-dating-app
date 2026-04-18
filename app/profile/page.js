'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('profile')
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState('')
  const [postImage, setPostImage] = useState(null)
  const [posting, setPosting] = useState(false)
  const [profile, setProfile] = useState({
    full_name: '',
    age: '',
    gender: '',
    looking_for: '',
    bio: '',
    location: '',
    interests: [],
    profile_photo: '',
    photos: [],
  })

  const photoInputRef = useRef(null)
  const postImageRef = useRef(null)

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
        profile_photo: data.profile_photo || '',
        photos: data.photos || [],
      })
    }

    fetchPosts(user.id)
    setLoading(false)
  }

  const fetchPosts = async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setPosts(data || [])
  }

  const uploadProfilePhoto = async (file) => {
    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setMessage('Error uploading photo: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    await supabase
      .from('profiles')
      .update({ profile_photo: publicUrl })
      .eq('id', user.id)

    setProfile(prev => ({ ...prev, profile_photo: publicUrl }))
    setMessage('Profile photo updated! ✅')
    setUploading(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const uploadAdditionalPhoto = async (file) => {
    setUploading(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-extra-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setMessage('Error uploading photo')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)

    const newPhotos = [...(profile.photos || []), publicUrl]

    await supabase
      .from('profiles')
      .update({ photos: newPhotos })
      .eq('id', user.id)

    setProfile(prev => ({ ...prev, photos: newPhotos }))
    setMessage('Photo added! ✅')
    setUploading(false)
    setTimeout(() => setMessage(''), 3000)
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
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Profile saved! ✅')
      setTimeout(() => window.location.href = '/dashboard', 1500)
    }
    setSaving(false)
  }

  const createPost = async () => {
    if (!newPost.trim() && !postImage) return
    setPosting(true)

    let imageUrl = null

    if (postImage) {
      const fileExt = postImage.name.split('.').pop()
      const fileName = `${user.id}-post-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, postImage, { upsert: true })

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        content: newPost.trim(),
        image_url: imageUrl,
      })
      .select()

    if (!error && data) {
      setPosts(prev => [data[0], ...prev])
      setNewPost('')
      setPostImage(null)
      setMessage('Post shared! ✅')
      setTimeout(() => setMessage(''), 3000)
    }
    setPosting(false)
  }

  const deletePost = async (postId) => {
    await supabase.from('posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
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
        <h1 className="font-bold text-gray-800 text-lg">My Profile</h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-white mx-4 mt-4 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'profile' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          👤 Profile
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'photos' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          📸 Photos
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
            activeTab === 'posts' ? 'bg-pink-500 text-white' : 'text-gray-500'
          }`}
        >
          📝 Posts
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="mx-4 mt-3 bg-green-100 text-green-600 text-sm text-center py-2 rounded-xl font-semibold">
          {message}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="px-4 mt-4 space-y-4">

          {/* Profile Photo */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => photoInputRef.current?.click()}
              className="w-28 h-28 rounded-full overflow-hidden bg-pink-200 flex items-center justify-center cursor-pointer relative"
            >
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">👤</span>
              )}
              <div className="absolute bottom-0 right-0 bg-pink-500 rounded-full w-8 h-8 flex items-center justify-center text-white text-sm">
                📷
              </div>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files[0] && uploadProfilePhoto(e.target.files[0])}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="mt-2 text-pink-500 text-sm font-semibold"
            >
              {uploading ? 'Uploading...' : 'Change Profile Photo'}
            </button>
          </div>

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
                    profile.gender === g ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-500'
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
                    profile.looking_for === l ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-500'
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

          {/* Save Button */}
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full bg-gradient-to-r from-pink-500 to-red-400 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="font-bold text-gray-800 mb-2">📸 My Photos</h2>
            <p className="text-gray-400 text-sm mb-3">Add up to 6 photos to your profile</p>
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full border-2 border-dashed border-pink-300 rounded-2xl py-6 text-pink-400 font-semibold text-center"
            >
              {uploading ? 'Uploading...' : '+ Add Photo'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files[0] && uploadAdditionalPhoto(e.target.files[0])}
            />
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-2 gap-3">
            {profile.profile_photo && (
              <div className="relative rounded-2xl overflow-hidden aspect-square">
                <img src={profile.profile_photo} alt="Profile" className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">Main</span>
              </div>
            )}
            {profile.photos?.map((photo, index) => (
              <div key={index} className="relative rounded-2xl overflow-hidden aspect-square">
                <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
            {!profile.profile_photo && profile.photos?.length === 0 && (
              <div className="col-span-2 text-center text-gray-400 py-10">
                No photos yet. Add your first photo!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="px-4 mt-4">

          {/* Create Post */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h2 className="font-bold text-gray-800 mb-3">📝 Share a Post</h2>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind? Share with everyone..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
            />

            {postImage && (
              <div className="mt-2 relative">
                <img
                  src={URL.createObjectURL(postImage)}
                  alt="Post preview"
                  className="w-full rounded-xl object-cover max-h-48"
                />
                <button
                  onClick={() => setPostImage(null)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => postImageRef.current?.click()}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-semibold"
              >
                📷 Add Photo
              </button>
              <button
                onClick={createPost}
                disabled={posting || (!newPost.trim() && !postImage)}
                className="flex-1 bg-pink-500 text-white py-2 rounded-xl text-sm font-bold disabled:opacity-50"
              >
                {posting ? 'Posting...' : 'Share Post'}
              </button>
            </div>
            <input
              ref={postImageRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files[0] && setPostImage(e.target.files[0])}
            />
          </div>

          {/* Posts List */}
          {posts.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <div className="text-5xl mb-2">📝</div>
              <p>No posts yet. Share your first post!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-pink-200 rounded-full overflow-hidden flex items-center justify-center">
                        {profile.profile_photo ? (
                          <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>👤</span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-gray-800">You</div>
                        <div className="text-gray-400 text-xs">
                          {new Date(post.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                  {post.content && (
                    <p className="text-gray-700 text-sm mb-2">{post.content}</p>
                  )}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full rounded-xl object-cover max-h-64"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}