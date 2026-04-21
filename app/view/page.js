'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabase'

function ViewProfileContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('id')

  const [currentUser, setCurrentUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [currentProfile, setCurrentProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [commentText, setCommentText] = useState({})
  const [showComments, setShowComments] = useState({})
  const [comments, setComments] = useState({})
  const [replyText, setReplyText] = useState({})
  const [showReply, setShowReply] = useState({})
  const [likedPhotos, setLikedPhotos] = useState([])

  function getFlag(location) {
    if (!location) return '🌍'
    const flags = {
      'kenya': '🇰🇪', 'nigeria': '🇳🇬', 'ghana': '🇬🇭', 'uganda': '🇺🇬',
      'nairobi': '🇰🇪', 'mombasa': '🇰🇪', 'kisumu': '🇰🇪', 'eldoret': '🇰🇪',
      'nakuru': '🇰🇪', 'usa': '🇺🇸', 'uk': '🇬🇧', 'south africa': '🇿🇦',
      'tanzania': '🇹🇿', 'ethiopia': '🇪🇹', 'rwanda': '🇷🇼',
    }
    const lower = location.toLowerCase()
    for (const [key, flag] of Object.entries(flags)) {
      if (lower.includes(key)) return flag
    }
    return '🌍'
  }

  useEffect(() => {
    if (userId) loadData()
    else setLoading(false)
  }, [userId])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setCurrentUser(user)

      const { data: cp } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setCurrentProfile(cp)

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      setProfile(profileData)

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, post_likes(user_id), post_comments(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setPosts(postsData || [])

      const { data: connection } = await supabase
        .from('connections')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .maybeSingle()
      setConnectionStatus(connection)

      const { data: photoLikes } = await supabase
        .from('photo_likes')
        .select('photo_url')
        .eq('user_id', user.id)
        .eq('profile_id', userId)
      setLikedPhotos(photoLikes?.map(l => l.photo_url) || [])

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sendRequest = async (type) => {
    const { error } = await supabase
      .from('connections')
      .insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        type: type,
        status: 'pending'
      })

    if (error) {
      setMessage('Already sent a request!')
    } else {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'connection_request',
        title: 'New Connection Request!',
        body: `${currentProfile?.full_name || currentProfile?.username} sent you a request`,
        reference_id: currentUser.id,
      })
      setMessage(`${type === 'dating' ? '💝 Dating' : '👋 Friend'} request sent!`)
      setConnectionStatus({ status: 'pending', type })
    }
    setTimeout(() => setMessage(''), 3000)
  }

  const togglePhotoLike = async (photoUrl) => {
    const isLiked = likedPhotos.includes(photoUrl)
    if (isLiked) {
      await supabase.from('photo_likes').delete()
        .eq('photo_url', photoUrl).eq('user_id', currentUser.id).eq('profile_id', userId)
      setLikedPhotos(prev => prev.filter(p => p !== photoUrl))
    } else {
      await supabase.from('photo_likes').insert({
        photo_url: photoUrl, user_id: currentUser.id, profile_id: userId,
      })
      setLikedPhotos(prev => [...prev, photoUrl])
      if (userId !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: userId, type: 'photo_liked',
          title: 'Someone liked your photo! ❤️',
          body: `${currentProfile?.full_name || currentProfile?.username} liked your photo`,
          reference_id: currentUser.id,
        })
      }
    }
  }

  const toggleLike = async (postId) => {
    const post = posts.find(p => p.id === postId)
    const isLiked = post?.post_likes?.some(l => l.user_id === currentUser.id)
    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id })
      if (userId !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: userId, type: 'post_liked',
          title: 'Someone liked your post! ❤️',
          body: `${currentProfile?.full_name || currentProfile?.username} liked your post`,
          reference_id: postId,
        })
      }
    }
    const { data: postsData } = await supabase
      .from('posts').select('*, post_likes(user_id), post_comments(count)')
      .eq('user_id', userId).order('created_at', { ascending: false })
    setPosts(postsData || [])
  }

  const fetchComments = async (postId) => {
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(*), replies:post_comments(*, profiles(*))')
      .eq('post_id', postId).is('parent_id', null).order('created_at', { ascending: true })
    setComments(prev => ({ ...prev, [postId]: data || [] }))
  }

  const toggleComments = async (postId) => {
    if (!showComments[postId]) await fetchComments(postId)
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  }

  const addComment = async (postId) => {
    const text = commentText[postId]?.trim()
    if (!text) return
    await supabase.from('post_comments').insert({
      post_id: postId, user_id: currentUser.id, content: text,
    })
    if (userId !== currentUser.id) {
      await supabase.from('notifications').insert({
        user_id: userId, type: 'post_commented',
        title: 'New comment on your post! 💬',
        body: `${currentProfile?.full_name || currentProfile?.username}: ${text}`,
        reference_id: postId,
      })
    }
    setCommentText(prev => ({ ...prev, [postId]: '' }))
    fetchComments(postId)
  }

  const addReply = async (postId, parentId) => {
    const text = replyText[parentId]?.trim()
    if (!text) return
    await supabase.from('post_comments').insert({
      post_id: postId, user_id: currentUser.id, parent_id: parentId, content: text,
    })
    setReplyText(prev => ({ ...prev, [parentId]: '' }))
    setShowReply(prev => ({ ...prev, [parentId]: false }))
    fetchComments(postId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">💝</div>
          <div className="text-pink-500 font-bold">Loading profile...</div>
        </div>
      </div>
    )
  }

  if (!userId || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">😔</div>
          <div className="text-gray-500 font-bold">User not found</div>
          <a href="/dashboard" className="mt-4 inline-block bg-pink-500 text-white px-6 py-2 rounded-full font-bold">
            Go Back
          </a>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentUser?.id === userId
  const allPhotos = [profile.profile_photo, ...(profile.photos || [])].filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href="/dashboard" className="text-gray-500 text-2xl">←</a>
        <h1 className="font-bold text-gray-900 text-lg">{profile.full_name || profile.username}</h1>
      </div>

      <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-pink-400 to-red-400 relative">
          <div className="absolute -bottom-10 left-4">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-pink-200 flex items-center justify-center">
              {profile.profile_photo ? (
                <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : <span className="text-3xl">👤</span>}
            </div>
          </div>
        </div>

        <div className="pt-12 px-4 pb-4">
          <h2 className="font-bold text-gray-900 text-xl">
            {profile.full_name || profile.username}{profile.age ? `, ${profile.age}` : ''}
          </h2>
          <p className="text-gray-400 text-sm">@{profile.username}</p>
          {profile.location && (
            <p className="text-gray-500 text-sm mt-1">{getFlag(profile.location)} {profile.location}</p>
          )}
          {profile.looking_for && (
            <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block font-semibold ${
              profile.looking_for === 'dating' ? 'bg-red-100 text-red-500' :
              profile.looking_for === 'friendship' ? 'bg-blue-100 text-blue-500' : 'bg-purple-100 text-purple-500'
            }`}>{profile.looking_for}</span>
          )}
          {profile.bio && <p className="text-gray-600 text-sm mt-3">{profile.bio}</p>}
          {profile.interests?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {profile.interests.map(interest => (
                <span key={interest} className="bg-pink-50 text-pink-500 text-xs px-2 py-1 rounded-full font-semibold">{interest}</span>
              ))}
            </div>
          )}

          {!isOwnProfile && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={() => sendRequest('friendship')} disabled={!!connectionStatus}
                className={`py-2.5 rounded-xl font-bold text-sm ${connectionStatus?.status === 'accepted' ? 'bg-green-100 text-green-600' : connectionStatus ? 'bg-gray-100 text-gray-400' : 'bg-blue-500 text-white'}`}>
                {connectionStatus?.status === 'accepted' ? '✓ Friends' : connectionStatus ? '⏳ Pending' : '👋 Add Friend'}
              </button>
              <button onClick={() => sendRequest('dating')} disabled={!!connectionStatus}
                className={`py-2.5 rounded-xl font-bold text-sm ${connectionStatus ? 'bg-gray-100 text-gray-400' : 'bg-pink-500 text-white'}`}>
                {connectionStatus ? '⏳ Pending' : '💝 Date Me'}
              </button>
              <a href={`/gifts?to=${userId}&name=${profile.full_name || profile.username}`}
                className="py-2.5 rounded-xl font-bold text-sm bg-yellow-400 text-white text-center">🎁 Send Gift</a>
              <a href="/chat" className="py-2.5 rounded-xl font-bold text-sm bg-gray-800 text-white text-center">💬 Message</a>
            </div>
          )}
        </div>
      </div>

      {allPhotos.length > 0 && (
        <div className="mx-4 mt-4">
          <h3 className="font-bold text-gray-800 mb-2">📸 Photos</h3>
          <div className="grid grid-cols-3 gap-2">
            {allPhotos.map((photo, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                <img src={photo} alt="" className="w-full h-full object-cover" />
                {!isOwnProfile && (
                  <button onClick={() => togglePhotoLike(photo)}
                    className="absolute bottom-1 right-1 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow text-sm">
                    {likedPhotos.includes(photo) ? '❤️' : '🤍'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-4 mt-4">
        <h3 className="font-bold text-gray-800 mb-2">📝 Posts</h3>
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400">No posts yet</div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => {
              const isLiked = post.post_likes?.some(l => l.user_id === currentUser?.id)
              const likesCount = post.post_likes?.length || 0
              const commentsCount = post.post_comments?.[0]?.count || 0
              return (
                <div key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 pb-2">
                    <div className="w-10 h-10 bg-pink-200 rounded-full overflow-hidden flex items-center justify-center">
                      {profile.profile_photo ? <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" /> : <span>👤</span>}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{profile.full_name || profile.username}</div>
                      <div className="text-gray-400 text-xs">{new Date(post.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  {post.content && <p className="text-gray-800 text-sm px-4 pb-2">{post.content}</p>}
                  {post.image_url && <img src={post.image_url} alt="Post" className="w-full object-cover max-h-80" />}
                  {(likesCount > 0 || commentsCount > 0) && (
                    <div className="flex items-center gap-3 px-4 py-2 text-xs text-gray-400">
                      {likesCount > 0 && <span>❤️ {likesCount} likes</span>}
                      {commentsCount > 0 && <button onClick={() => toggleComments(post.id)}>💬 {commentsCount} comments</button>}
                    </div>
                  )}
                  <div className="flex border-t border-gray-50 mx-4">
                    <button onClick={() => toggleLike(post.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold ${isLiked ? 'text-pink-500' : 'text-gray-400'}`}>
                      {isLiked ? '❤️' : '🤍'} Like
                    </button>
                    <button onClick={() => toggleComments(post.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-400">
                      💬 Comment
                    </button>
                    <a href={`/gifts?to=${userId}&name=${profile.full_name || profile.username}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-400">
                      🎁 Gift
                    </a>
                  </div>
                  {showComments[post.id] && (
                    <div className="border-t border-gray-50 px-4 py-3 space-y-3">
                      {(comments[post.id] || []).map(comment => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-8 h-8 bg-pink-100 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {comment.profiles?.profile_photo ? <img src={comment.profiles.profile_photo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">👤</span>}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-2xl px-3 py-2">
                              <div className="font-bold text-gray-800 text-xs">{comment.profiles?.full_name || comment.profiles?.username}</div>
                              <div className="text-gray-700 text-sm mt-0.5">{comment.content}</div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-2">
                              <span className="text-gray-400 text-xs">{new Date(comment.created_at).toLocaleDateString()}</span>
                              <button onClick={() => setShowReply(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                className="text-pink-500 text-xs font-semibold">Reply</button>
                            </div>
                            {showReply[comment.id] && (
                              <div className="flex gap-2 mt-2">
                                <input type="text" value={replyText[comment.id] || ''}
                                  onChange={(e) => setReplyText(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                  placeholder="Write a reply..."
                                  className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-800 focus:outline-none" />
                                <button onClick={() => addReply(post.id, comment.id)}
                                  className="bg-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">Reply</button>
                              </div>
                            )}
                            {comment.replies?.map(reply => (
                              <div key={reply.id} className="flex gap-2 mt-2 ml-4">
                                <div className="w-6 h-6 bg-pink-100 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {reply.profiles?.profile_photo ? <img src={reply.profiles.profile_photo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">👤</span>}
                                </div>
                                <div className="bg-gray-50 rounded-2xl px-3 py-2 flex-1">
                                  <div className="font-bold text-gray-800 text-xs">{reply.profiles?.full_name || reply.profiles?.username}</div>
                                  <div className="text-gray-700 text-xs mt-0.5">{reply.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <div className="w-8 h-8 bg-pink-200 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {currentProfile?.profile_photo ? <img src={currentProfile.profile_photo} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">👤</span>}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input type="text" value={commentText[post.id] || ''}
                            onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                            placeholder="Write a comment..."
                            className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-sm text-gray-800 focus:outline-none" />
                          <button onClick={() => addComment(post.id)}
                            className="bg-pink-500 text-white px-3 py-2 rounded-full text-sm font-bold">➤</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {message && (
        <div className="fixed bottom-4 left-4 right-4 bg-green-500 text-white text-center py-3 rounded-2xl font-bold shadow-lg z-50">
          {message}
        </div>
      )}
    </div>
  )
}

export default function ViewProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">💝</div>
          <div className="text-pink-500 font-bold">Loading...</div>
        </div>
      </div>
    }>
      <ViewProfileContent />
    </Suspense>
  )
}