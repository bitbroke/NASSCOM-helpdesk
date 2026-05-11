'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/admin`
      }
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Subtle glow effect */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Admin Portal</h1>
          <p className="text-zinc-400 text-sm">Sign in to access the Multi-Agent Council dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="relative z-10 space-y-4">
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Email Address</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#27272a] border border-white/5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 transition-all outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl px-4 py-3 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Send Magic Link'
            )}
          </button>
        </form>

        {message && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-medium relative z-10 ${message.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}
