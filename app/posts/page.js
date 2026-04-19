'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PostsPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState({})
  const [replyText, setReplyText] = useState({})
  const [showComments, setShowComments] = useState({})
  const [showReply, setShowReply] = useState({})
  const [comments, setComments] = useState({})

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

    fetchPosts(user.id)
  }

  const fetchPosts = async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profiles(*),
        post_likes(user_id),
        post_comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    setPosts(data || [])
    setLoading(false)
  }

  const toggleLike = async (postId) => {
    const post = posts.find(p => p.id === postId)
    const isLiked = post?.post_likes?.some(l => l.user_id === user.id)

    if (isLiked) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: user.id })
    }

    fetchPosts(user.id)
  }

  const fetchComments = async (postId) => {
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(*), replies:post_comments(*, profiles(*))')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    setComments(prev => ({ ...prev, [postId]: data || [] }))
  }

  const toggleComments = async (postId) => {
    if (!showComments[postId]) {
      await fetchComments(postId)
    }
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }))
  }

  const addComment = async (postId) => {
    const text = commentText[postId]?.trim()
    if (!text) return

    await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      content: text,
    })

    setCommentText(prev => ({ ...prev, [postId]: '' }))
    fetchComments(postId)
    fetchPosts(user.id)
  }

  const addReply = async (postId, parentId) => {
    const text = replyText[parentId]?.trim()
    if (!text) return

    await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: user.id,
      parent_id: parentId,
      content: text,
    })

    setReplyText(prev => ({ ...prev, [parentId]: '' }))
    setShowReply(prev => ({ ...prev, [parentId]: false }))
    fetchComments(postId)
  }

  const deleteComment = async (commentId, postId) => {
    await supabase.from('post_comments').delete().eq('id', commentId)
    fetchComments(postId)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-pink-500 text-xl font-bold">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <a href="/dashboard" className="text-gray-500 text-2xl">←</a>
        <h1 className="font-bold text-gray-900 text-lg">Posts</h1>
        <a
          href="/profile"
          className="ml-auto bg-pink-500 text-white px-3 py-1.5 rounded-full text-sm font-bold"
        >
          + New Post
        </a>
      </div>

      {/* Posts */}
      <div className="space-y-3 pt-3 px-4">
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-3">📝</div>
            <p className="text-gray-500 font-semibold">No posts yet</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to share something!</p>
            <a
              href="/profile"
              className="inline-block mt-4 bg-pink-500 text-white px-6 py-2 rounded-full font-bold text-sm"
            >
              Create Post
            </a>
          </div>
        ) : (
          posts.map(post => {
            const isLiked = post.post_likes?.some(l => l.user_id === user.id)
            const likesCount = post.post_likes?.length || 0
            const commentsCount = post.post_comments?.[0]?.count || 0

            return (
              <div key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

                {/* Post Header */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <a href={`/user/${post.profiles?.username}`}>
                    <div className="w-10 h-10 bg-pink-200 rounded-full overflow-hidden flex items-center justify-center">
                      {post.profiles?.profile_photo ? (
                        <img src={post.profiles.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span>👤</span>
                      )}
                    </div>
                  </a>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 text-sm">
                      {post.profiles?.full_name || post.profiles?.username}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {new Date(post.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {post.user_id === user.id && (
                    <button
                      onClick={async () => {
                        await supabase.from('posts').delete().eq('id', post.id)
                        fetchPosts(user.id)
                      }}
                      className="text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Post Content */}
                {post.content && (
                  <p className="text-gray-800 text-sm px-4 pb-2">{post.content}</p>
                )}

                {/* Post Image */}
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full object-cover max-h-80"
                  />
                )}

                {/* Like & Comment counts */}
                {(likesCount > 0 || commentsCount > 0) && (
                  <div className="flex items-center gap-3 px-4 py-2 text-xs text-gray-400">
                    {likesCount > 0 && <span>❤️ {likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>}
                    {commentsCount > 0 && (
                      <button onClick={() => toggleComments(post.id)}>
                        💬 {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
                      </button>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex border-t border-gray-50 mx-4">
                  <button
                    onClick={() => toggleLike(post.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-all ${
                      isLiked ? 'text-pink-500' : 'text-gray-400'
                    }`}
                  >
                    {isLiked ? '❤️' : '🤍'} Like
                  </button>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-400"
                  >
                    💬 Comment
                  </button>
                  <a
                    href={`/gifts?to=${post.user_id}&name=${post.profiles?.full_name || post.profiles?.username}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-gray-400"
                  >
                    🎁 Gift
                  </a>
                </div>

                {/* Comments Section */}
                {showComments[post.id] && (
                  <div className="border-t border-gray-50 px-4 py-3 space-y-3">

                    {/* Comments List */}
                    {(comments[post.id] || []).map(comment => (
                      <div key={comment.id}>
                        <div className="flex gap-2">
                          <div className="w-8 h-8 bg-pink-100 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {comment.profiles?.profile_photo ? (
                              <img src={comment.profiles.profile_photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-2xl px-3 py-2">
                              <div className="font-bold text-gray-800 text-xs">
                                {comment.profiles?.full_name || comment.profiles?.username}
                              </div>
                              <div className="text-gray-700 text-sm mt-0.5">{comment.content}</div>
                            </div>
                            <div className="flex items-center gap-3 mt-1 ml-2">
                              <span className="text-gray-400 text-xs">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              <button
                                onClick={() => setShowReply(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                                className="text-pink-500 text-xs font-semibold"
                              >
                                Reply
                              </button>
                              {comment.user_id === user.id && (
                                <button
                                  onClick={() => deleteComment(comment.id, post.id)}
                                  className="text-red-400 text-xs"
                                >
                                  Delete
                                </button>
                              )}
                            </div>

                            {/* Reply Input */}
                            {showReply[comment.id] && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  value={replyText[comment.id] || ''}
                                  onChange={(e) => setReplyText(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                  placeholder="Write a reply..."
                                  className="flex-1 bg-gray-100 rounded-full px-3 py-1.5 text-xs text-gray-800 focus:outline-none"
                                />
                                <button
                                  onClick={() => addReply(post.id, comment.id)}
                                  className="bg-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold"
                                >
                                  Reply
                                </button>
                              </div>
                            )}

                            {/* Replies */}
                            {comment.replies?.map(reply => (
                              <div key={reply.id} className="flex gap-2 mt-2 ml-4">
                                <div className="w-6 h-6 bg-pink-100 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {reply.profiles?.profile_photo ? (
                                    <img src={reply.profiles.profile_photo} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs">👤</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="bg-gray-50 rounded-2xl px-3 py-2">
                                    <div className="font-bold text-gray-800 text-xs">
                                      {reply.profiles?.full_name || reply.profiles?.username}
                                    </div>
                                    <div className="text-gray-700 text-xs mt-0.5">{reply.content}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add Comment */}
                    <div className="flex gap-2 mt-2">
                      <div className="w-8 h-8 bg-pink-200 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {profile?.profile_photo ? (
                          <img src={profile.profile_photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs">👤</span>
                        )}
                      </div>
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={commentText[post.id] || ''}
                          onChange={(e) => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                          placeholder="Write a comment..."
                          className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-sm text-gray-800 focus:outline-none"
                        />
                        <button
                          onClick={() => addComment(post.id)}
                          className="bg-pink-500 text-white px-3 py-2 rounded-full text-sm font-bold"
                        >
                          ➤
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}