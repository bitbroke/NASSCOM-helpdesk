'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Tilt3D } from '@/components/ui/Tilt3D'

// CSS-only 3D wireframe shapes
function WireTetrahedron({ className = "" }: { className?: string }) {
  return (
    <div className={`float-geometry pointer-events-none ${className}`} style={{ transformStyle: "preserve-3d" }}>
      <div className="relative w-20 h-20" style={{ transformStyle: "preserve-3d" }}>
        {/* Front face */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          transform: "rotateX(-20deg) translateZ(10px)",
        }} />
        {/* Left face */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 0% 100%, 50% 70%)",
          transform: "rotateY(-40deg) translateZ(5px)",
        }} />
        {/* Right face */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 100% 100%, 50% 70%)",
          transform: "rotateY(40deg) translateZ(5px)",
        }} />
      </div>
    </div>
  )
}

function WireOctahedron({ className = "" }: { className?: string }) {
  return (
    <div className={`float-geometry-reverse pointer-events-none ${className}`} style={{ transformStyle: "preserve-3d" }}>
      <div className="relative w-16 h-16" style={{ transformStyle: "preserve-3d" }}>
        {/* Top diamond */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          transform: "rotateY(0deg) translateZ(8px)",
        }} />
        {/* Side diamond */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          transform: "rotateY(60deg) translateZ(8px)",
        }} />
        {/* Third face */}
        <div className="absolute inset-0 wire-face" style={{
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          transform: "rotateY(120deg) translateZ(8px)",
        }} />
      </div>
    </div>
  )
}

function WireCube({ className = "" }: { className?: string }) {
  const size = 40;
  const half = size / 2;
  return (
    <div className={`float-geometry-slow pointer-events-none ${className}`} style={{ transformStyle: "preserve-3d" }}>
      <div className="relative" style={{ width: size, height: size, transformStyle: "preserve-3d" }}>
        {/* Front */}
        <div className="absolute inset-0 wire-face" style={{ transform: `translateZ(${half}px)`, width: size, height: size }} />
        {/* Back */}
        <div className="absolute inset-0 wire-face" style={{ transform: `translateZ(-${half}px) rotateY(180deg)`, width: size, height: size }} />
        {/* Left */}
        <div className="absolute inset-0 wire-face" style={{ transform: `translateX(-${half}px) rotateY(-90deg)`, width: size, height: size, transformOrigin: "right center" }} />
        {/* Right */}
        <div className="absolute inset-0 wire-face" style={{ transform: `translateX(${half}px) rotateY(90deg)`, width: size, height: size, transformOrigin: "left center" }} />
        {/* Top */}
        <div className="absolute inset-0 wire-face" style={{ transform: `translateY(-${half}px) rotateX(90deg)`, width: size, height: size, transformOrigin: "bottom center" }} />
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      setMessage("Error: Supabase is not configured. Check your environment variables.")
      return
    }
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`
      }
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Check your email for the magic link!')
    }
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'github') => {
    if (!supabase) {
      setMessage("Error: Supabase is not configured. Check your environment variables.")
      return
    }
    setOauthLoading(provider)
    setMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`
      }
    })

    if (error) {
      setMessage(`Error: ${error.message}`)
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative overflow-hidden" style={{ background: 'var(--bg-primary)', perspective: '1200px' }}>
      
      {/* Floating 3D wireframe shapes */}
      <WireTetrahedron className="absolute top-[15%] left-[10%] opacity-40" />
      <WireOctahedron className="absolute top-[25%] right-[12%] opacity-30" />
      <WireCube className="absolute bottom-[20%] left-[15%] opacity-25" />
      <WireTetrahedron className="absolute bottom-[15%] right-[8%] opacity-35" />
      <WireOctahedron className="absolute top-[60%] left-[60%] opacity-20" />
      <WireCube className="absolute top-[8%] right-[35%] opacity-20" />

      <Tilt3D maxTilt={6} containerClassName="w-full max-w-md z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full rounded-3xl p-8 relative overflow-hidden glass-panel-3d neon-glow-subtle"
        >
          {/* Subtle glow */}
          <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(212,160,23,0.08)' }} />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none"
            style={{ background: 'rgba(245,166,35,0.06)' }} />

          <div className="relative z-10 text-center space-y-2 mb-8">
            <Link href="/" className="inline-block mb-4">
              <span className="text-2xl font-black tracking-tight text-3d" style={{ color: 'var(--charcoal)' }}>SUGOI</span>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-3d" style={{ color: 'var(--charcoal)' }}>Admin Portal</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to access the Multi-Agent Council dashboard</p>
          </div>

          {!supabase && (
            <div className="relative z-10 mb-6 p-4 rounded-2xl text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20">
              Warning: Supabase keys are not set. Authentication features are disabled. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="relative z-10 space-y-3 mb-6">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOAuth('google')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--charcoal)' }}
            >
              {oauthLoading === 'google' ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </motion.button>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOAuth('github')}
              disabled={oauthLoading !== null}
              className="w-full flex items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--charcoal)' }}
            >
              {oauthLoading === 'github' ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              )}
              Continue with GitHub
            </motion.button>
          </div>

          {/* Divider */}
          <div className="relative z-10 flex items-center gap-4 mb-6">
            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />
          </div>

          {/* Magic Link Form */}
          <form onSubmit={handleLogin} className="relative z-10 space-y-4">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold uppercase tracking-widest ml-1" style={{ color: 'var(--text-muted)' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm transition-all outline-none focus:ring-1 focus:ring-[var(--honey)]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', color: 'var(--charcoal)' }}
                required
              />
            </div>

            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed btn-honey"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
              ) : (
                'Send Magic Link'
              )}
            </motion.button>
          </form>

          {message && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-2xl text-sm font-medium relative z-10"
              style={{
                background: message.includes('Error') ? 'rgba(220,38,38,0.08)' : 'rgba(16,185,129,0.08)',
                color: message.includes('Error') ? '#f87171' : '#34d399',
                border: `1px solid ${message.includes('Error') ? 'rgba(220,38,38,0.15)' : 'rgba(16,185,129,0.15)'}`,
              }}
            >
              {message}
            </motion.div>
          )}

          <div className="text-center mt-6">
            <Link href="/" className="text-xs font-medium transition-colors hover:text-[var(--honey)]" style={{ color: 'var(--text-muted)' }}>
              ← Back to Home
            </Link>
          </div>
        </motion.div>
      </Tilt3D>
    </div>
  )
}
