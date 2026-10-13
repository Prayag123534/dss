import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from './lib/supabase'
import {
  ArrowRight,
  BookOpenText,
  Building2,
  CalendarDays,
  ImagePlus,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  Phone,
  Trash2,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Trophy,
  Users,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Notice', to: '/notice' },
  { label: 'Complain', to: '/complain' },
  { label: 'Contact', to: '/contact' },
]

const noticeCategories = ['All', 'Academic', 'Administrative', 'Events', 'Results']

const schoolInfo = {
  name: 'Darbar Secondary School',
  location: 'Aarughat-8, Gorkha, Nepal',
  principal: 'Mr. Krishna Bahadur Shrestha',
  coPrincipal: 'Mrs. Sunita Poudel',
  email: 'info@darbarsecondary.edu.np',
  phone: '+977-9861234567',
}

const defaultNotices = [
  {
    id: 1,
    title: 'Admission Open for the New Academic Session',
    category: 'Academic',
    date: '2026-10-12',
    summary:
      'Applications are now open for students seeking enrollment in the upcoming academic session. Students and parents may contact the school office for details.',
    image: '/school-hero-user.jpg',
  },
  {
    id: 2,
    title: 'Parent Orientation Program',
    category: 'Administrative',
    date: '2026-10-03',
    summary:
      'Parents are invited to attend the orientation meeting to review classroom expectations, academic planning, and school routines for the term.',
    image: '',
  },
  {
    id: 3,
    title: 'Annual Sports Week Registration',
    category: 'Events',
    date: '2026-09-26',
    summary:
      'Students can register for athletics and indoor events as part of the school sports week. Participation from every grade is encouraged.',
    image: '',
  },
  {
    id: 4,
    title: 'Final Examination Results Published',
    category: 'Results',
    date: '2026-09-18',
    summary:
      'The school has published the final examination results for all classes. Students and parents may collect the original marksheets from the office.',
    image: '',
  },
]

function mapNotice(row) {
  const image = row.image_path
    ? supabase.storage.from('notice-images').getPublicUrl(row.image_path).data.publicUrl
    : row.image_url || ''

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: row.notice_date,
    summary: row.summary,
    image,
    imagePath: row.image_path,
  }
}

const noticeSchema = z.object({
  title: z.string().min(6, 'Title should be at least 6 characters'),
  category: z.string().min(2, 'Please select a category'),
  date: z.string().min(1, 'Please include a date'),
  summary: z.string().min(12, 'Summary should be at least 12 characters'),
  image: z
    .string()
    .optional()
    .refine((value) => !value || /^https?:\/\//i.test(value.trim()), {
      message: 'Image URL must start with http:// or https://',
    }),
})

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('darbar-theme') || 'light')
  const [notices, setNotices] = useState(supabase ? [] : defaultNotices)
  const [noticesLoading, setNoticesLoading] = useState(Boolean(supabase))
  const [noticeStorageError, setNoticeStorageError] = useState('')
  const [noticeLoadError, setNoticeLoadError] = useState('')
  const [complaints, setComplaints] = useState([])
  const [complaintsLoading, setComplaintsLoading] = useState(false)
  const [complaintError, setComplaintError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('darbar-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true

    const loadNotices = async () => {
      if (!supabase) {
        setNotices(defaultNotices)
        setNoticesLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('notices')
        .select('id, title, category, notice_date, summary, image_url, image_path')
        .order('notice_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setNotices([])
        setNoticesLoading(false)
        setNoticeLoadError(`Notices could not be loaded: ${error.message}`)
        return
      }

      setNotices(data.map(mapNotice))
      setNoticesLoading(false)
      setNoticeLoadError('')
    }

    loadNotices()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!isAdmin || !supabase) return undefined

    let active = true
    const loadComplaints = async () => {
      setComplaintsLoading(true)
      setComplaintError('')
      const { data, error } = await supabase
        .from('complaints')
        .select('id, name, contact, category, message, image_paths, status, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        if (active) {
          setComplaints([])
          setComplaintError(`Complaints could not be loaded: ${error.message}`)
          setComplaintsLoading(false)
        }
        return
      }

      try {
        const loadedComplaints = await Promise.all(data.map(async (row) => {
          const images = await Promise.all((row.image_paths || []).map(async (path) => {
            const { data: signedImage, error: imageError } = await supabase.storage
              .from('complaint-images')
              .createSignedUrl(path, 3600)
            if (imageError) throw new Error(`An attached image could not be loaded: ${imageError.message}`)
            return { path, url: signedImage.signedUrl }
          }))

          return {
            id: row.id,
            name: row.name,
            contact: row.contact,
            type: row.category,
            message: row.message,
            images,
            status: row.status,
            createdAt: row.created_at,
          }
        }))

        if (active) setComplaints(loadedComplaints)
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : String(error)
          setComplaintError(`Complaint images could not be loaded: ${message}`)
        }
      } finally {
        if (active) setComplaintsLoading(false)
      }
    }

    loadComplaints()
    return () => { active = false }
  }, [isAdmin])

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    const syncAdmin = async (session) => {
      if (!session?.user) {
        if (active) {
          setIsAdmin(false)
          setComplaints([])
          setComplaintsLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('school_admins')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        setNoticeStorageError(`Admin access could not be verified: ${error.message}`)
        setIsAdmin(false)
        setComplaints([])
        return
      }
      setIsAdmin(Boolean(data))
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setNoticeStorageError(`Login session could not be checked: ${error.message}`)
        return
      }
      syncAdmin(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => syncAdmin(session), 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleAdminLogin = async (email, password) => {
    if (!supabase) {
      return { error: 'Secure admin login is not configured yet. Add the Supabase URL and publishable key to .env.local.' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      return { error: 'Unable to sign in. Check the email and password, then try again.' }
    }

    const { data: admin, error: permissionError } = await supabase
      .from('school_admins')
      .select('user_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (permissionError || !admin) {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        return { error: `This account is not authorized, and its session could not be cleared: ${signOutError.message}` }
      }
      return { error: permissionError ? `Admin permission could not be verified: ${permissionError.message}` : 'This account is not authorized to manage school notices.' }
    }

    setIsAdmin(true)
    setNoticeStorageError('')
    setLoginOpen(false)
    return { success: true }
  }

  const handleLogout = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setNoticeStorageError(`Could not log out: ${error.message}`)
      return
    }
    setIsAdmin(false)
    setComplaints([])
    setComplaintsLoading(false)
    setNoticeStorageError('')
  }

  const handleAddNotice = async (values) => {
    setNoticeStorageError('')
    if (!supabase) {
      setNoticeStorageError('Secure notice publishing is unavailable until Supabase is configured.')
      return false
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setNoticeStorageError(userError ? `Your admin session could not be verified: ${userError.message}` : 'Please sign in again to publish a notice.')
      return false
    }

    let imagePath = null
    if (values.imageFile) {
      const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const extension = extensionByType[values.imageFile.type]
      if (!extension || values.imageFile.size > 1024 * 1024) {
        setNoticeStorageError('Choose a JPG, PNG, or WebP image no larger than 1 MB.')
        return false
      }

      imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from('notice-images')
        .upload(imagePath, values.imageFile, { contentType: values.imageFile.type, upsert: false })

      if (uploadError) {
        setNoticeStorageError(`The image could not be uploaded: ${uploadError.message}`)
        return false
      }
    }

    const { data, error } = await supabase
      .from('notices')
      .insert({
        title: values.title,
        category: values.category,
        notice_date: values.date,
        summary: values.summary,
        image_url: imagePath ? null : values.image?.trim() || null,
        image_path: imagePath,
      })
      .select('id, title, category, notice_date, summary, image_url, image_path')
      .single()

    if (error) {
      if (imagePath) {
        const { error: cleanupError } = await supabase.storage.from('notice-images').remove([imagePath])
        if (cleanupError) {
          setNoticeStorageError(`The notice could not be saved: ${error.message}. The uploaded image also could not be removed: ${cleanupError.message}`)
          return false
        }
      }
      setNoticeStorageError(`The notice could not be saved: ${error.message}`)
      return false
    }

    setNotices((current) => [mapNotice(data), ...current])
    return true
  }

  const handleDeleteNotice = async (notice) => {
    setNoticeStorageError('')
    const { error } = await supabase.from('notices').delete().eq('id', notice.id)
    if (error) {
      setNoticeStorageError(`The notice could not be deleted: ${error.message}`)
      return
    }

    setNotices((current) => current.filter((item) => item.id !== notice.id))
    if (notice.imagePath) {
      const { error: imageError } = await supabase.storage.from('notice-images').remove([notice.imagePath])
      if (imageError) {
        setNoticeStorageError(`The notice was deleted, but its image could not be removed: ${imageError.message}`)
      }
    }
  }

  const handleAddComplaint = async (complaint) => {
    if (!supabase) {
      return { error: 'Complaint submission is not configured. Please contact the school office directly.' }
    }

    const id = crypto.randomUUID()
    const uploadedPaths = []
    const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

    for (const file of complaint.attachments) {
      const extension = extensionByType[file.type]
      if (!extension || file.size > 1024 * 1024) {
        return { error: 'Each attachment must be a JPG, PNG, or WebP image no larger than 1 MB.' }
      }
    }

    try {
      for (const file of complaint.attachments) {
        const path = `${id}/${crypto.randomUUID()}.${extensionByType[file.type]}`
        const { error: uploadError } = await supabase.storage
          .from('complaint-images')
          .upload(path, file, { contentType: file.type, upsert: false })

        if (uploadError) throw new Error(`An image could not be uploaded: ${uploadError.message}`)
        uploadedPaths.push(path)
      }

      const { error } = await supabase.from('complaints').insert({
        id,
        name: complaint.name.trim(),
        contact: complaint.contact.trim(),
        category: complaint.type,
        message: complaint.message.trim(),
        image_paths: uploadedPaths,
      })

      if (error) {
        const message = error.code === 'PGRST205'
          ? 'The complaint service is not configured yet. Please contact the school office.'
          : `Your complaint could not be submitted: ${error.message}`
        throw new Error(message)
      }
      return { success: true }
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage.from('complaint-images').remove(uploadedPaths)
        if (cleanupError) {
          const message = error instanceof Error ? error.message : String(error)
          return { error: `${message}. Uploaded images could not be cleaned up: ${cleanupError.message}` }
        }
      }

      return { error: error instanceof Error ? error.message : String(error) }
    }
  }

  const handleComplaintStatus = async (complaintId, nextStatus) => {
    setComplaintError('')
    const { error } = await supabase
      .from('complaints')
      .update({ status: nextStatus })
      .eq('id', complaintId)
      .select('id')
      .single()

    if (error) {
      setComplaintError(`Complaint status could not be updated: ${error.message}`)
      return false
    }

    setComplaints((current) => current.map((item) => (
      item.id === complaintId ? { ...item, status: nextStatus } : item
    )))
    return true
  }

  const handleDeleteComplaint = async (complaintId) => {
    setComplaintError('')
    const complaint = complaints.find((item) => item.id === complaintId)
    const { error } = await supabase.from('complaints').delete().eq('id', complaintId)
    if (error) {
      setComplaintError(`Complaint could not be deleted: ${error.message}`)
      return false
    }

    setComplaints((current) => current.filter((item) => item.id !== complaintId))
    if (complaint?.images.length) {
      const { error: imageError } = await supabase.storage
        .from('complaint-images')
        .remove(complaint.images.map((image) => image.path))
      if (imageError) {
        setComplaintError(`The complaint was deleted, but its images could not be removed: ${imageError.message}`)
        return false
      }
    }
    return true
  }

  return (
    <BrowserRouter>
      <Layout
        theme={theme}
        setTheme={setTheme}
        isAdmin={isAdmin}
        onLogout={handleLogout}
        onAdminLoginOpen={() => setLoginOpen(true)}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/notice"
            element={
              <NoticePage
                notices={notices}
                noticesLoading={noticesLoading}
                isAdmin={isAdmin}
                onAddNotice={handleAddNotice}
                onDeleteNotice={handleDeleteNotice}
                noticeStorageError={noticeStorageError}
                noticeLoadError={noticeLoadError}
              />
            }
          />
          <Route path="/complain" element={<ComplainPage onSubmitComplaint={handleAddComplaint} />} />
          <Route
            path="/admin/complaints"
            element={
              <AdminComplaintsPage
                isAdmin={isAdmin}
                complaints={complaints}
                isLoading={complaintsLoading}
                error={complaintError}
                onStatusChange={handleComplaintStatus}
                onDelete={handleDeleteComplaint}
                onAdminLoginOpen={() => setLoginOpen(true)}
              />
            }
          />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </Layout>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} onSubmit={handleAdminLogin} />
    </BrowserRouter>
  )
}

function Layout({ theme, setTheme, isAdmin, onLogout, onAdminLoginOpen, children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const visibleNavItems = isAdmin
    ? [...navItems, { label: 'Complaints', to: '/admin/complaints' }]
    : navItems

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#102b59] text-lg font-bold text-white shadow-soft sm:h-11 sm:w-11">
              <School size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#b6862d] sm:text-[10px] sm:tracking-[0.28em]">Darbar</p>
              <p className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300 sm:text-sm">Secondary School</p>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-7 md:flex">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${
                    isActive
                      ? 'text-[#b6862d]'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunMedium size={18} /> : <Moon size={18} />}
            </button>

            {isAdmin ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <LogOut size={16} /> Logout
              </button>
            ) : (
              <button
                type="button"
                onClick={onAdminLoginOpen}
                aria-label="Portal Login"
                title="Portal Login"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#f3b239] px-2.5 text-xs font-bold text-[#102b59] transition hover:bg-[#efaa2d] sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
              >
                <ShieldCheck size={16} className="sm:hidden" />
                <span className="sm:hidden">Login</span>
                <span className="hidden sm:inline">Portal Login</span>
                <ArrowRight size={16} className="hidden sm:inline" />
              </button>
            )}

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 md:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Open menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
            <div className="flex flex-col gap-2">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive
                        ? 'bg-[#f7f2e8] text-[#102b59] dark:bg-slate-800 dark:text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102b59] text-white">
                <School size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#102b59] dark:text-[#dfeafe]">
                  Darbar
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              A caring learning community focused on values, discipline, and academic ambition.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Explore
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {visibleNavItems.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className="transition hover:text-[#102b59] dark:hover:text-[#dfeafe]">
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Contact
            </h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2"><MapPin size={16} className="mt-0.5" /> {schoolInfo.location}</li>
              <li className="flex gap-2"><Phone size={16} className="mt-0.5" /> {schoolInfo.phone}</li>
              <li className="flex gap-2"><Mail size={16} className="mt-0.5" /> {schoolInfo.email}</li>
            </ul>
          </div>

        </div>

        <div className="border-t border-slate-200 bg-slate-50 py-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          © 2026 Darbar Secondary School. All rights reserved.
        </div>
      </footer>
    </div>
  )
}

function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#102b59] text-white">
        <img
          src="/school-hero-user.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#091a35]/90 via-[#102b59]/75 to-[#102b59]/35" />

        <div className="mx-auto flex min-h-[520px] max-w-7xl items-center px-4 py-20 sm:px-6 md:min-h-[580px] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100">
              <Sparkles size={15} className="text-[#f5c866]" /> Admissions open
            </div>

            <h1 className="mt-7 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Learning with
              <span className="mt-2 block text-[#f3b239]">purpose and heart.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
              A nurturing school community where students grow in confidence, discipline, and academic achievement.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <NavLink to="/about" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f3b239] px-6 py-3 text-sm font-bold text-[#102b59] transition hover:bg-[#efaa2d]">
                Discover our school
              </NavLink>
              <NavLink to="/notice" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                View notices
              </NavLink>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#edf1f6] px-4 py-12 transition-colors dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            {
              icon: BookOpenText,
              title: 'Academic excellence',
              text: 'Strong classroom routines and a focused curriculum help every learner progress with clarity and confidence.',
            },
            {
              icon: ShieldCheck,
              title: 'Safe environment',
              text: 'Students are guided by caring teachers in a disciplined, respectful, and supportive learning atmosphere.',
            },
            {
              icon: Trophy,
              title: 'Character & growth',
              text: 'Sports, culture, leadership, and teamwork give students room to build confidence beyond the classroom.',
            },
          ].map(({ icon: Icon, title, text }) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_24px_50px_rgba(15,23,42,0.08)] transition-colors dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#102b59] dark:bg-slate-800 dark:text-[#dfeafe]">
                <Icon size={28} />
              </div>
              <h3 className="text-2xl font-bold text-[#102b59] dark:text-white">{title}</h3>
              <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{text}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="bg-white px-4 py-14 dark:bg-slate-950 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_28px_70px_rgba(15,23,42,0.1)] dark:border-slate-800 dark:bg-slate-900">
            <img
              src="/school-hero-user.jpg"
              alt="School building and campus"
              loading="lazy"
              className="h-[260px] w-full rounded-[24px] object-cover object-center sm:h-[360px] lg:h-[420px]"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#102b59] dark:text-[#dfeafe]">About us</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-[#102b59] dark:text-white md:text-5xl">
              Built on values, discipline, and opportunity.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
              At Darbar Secondary School, we believe in developing confident learners who are ready to serve their community with integrity and purpose.
            </p>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
              We blend academic strength with character-building, leadership, and responsibility so every child can thrive in their own way.
            </p>
            <NavLink to="/about" className="mt-7 inline-flex min-h-11 items-center gap-2 text-base font-bold text-[#102b59] dark:text-[#dfeafe]">
              Read more <ArrowRight size={18} />
            </NavLink>
          </div>
        </div>
      </section>
    </>
  )
}

function AboutPage() {
  const leadership = [
    {
      name: schoolInfo.principal,
      role: 'Principal',
      body: 'Leads the school with a strong commitment to academic excellence, discipline, and learner success.',
    },
    {
      name: schoolInfo.coPrincipal,
      role: 'Co-Principal',
      body: 'Supports academic coordination, school culture, and student-centered teaching across all grades.',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">About us</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black text-slate-900 dark:text-white md:text-5xl">
          A school rooted in learning, service, and community.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
          Darbar Secondary School is committed to creating a focused and welcoming learning environment where every student is encouraged to grow academically, socially, and emotionally.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          {
            icon: Building2,
            title: 'Our foundation',
            text: 'We have built a steady academic tradition that values discipline, respect, and measurable progress.',
          },
          {
            icon: BookOpenText,
            title: 'Our vision',
            text: 'To help students become capable, confident, and responsible citizens with strong values and skills.',
          },
          {
            icon: Users,
            title: 'Our mission',
            text: 'To provide a balanced educational experience that supports academic growth and personal character.',
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#102b59] dark:bg-slate-800 dark:text-[#dfeafe]">
              <Icon size={22} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Leadership</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {leadership.map((member) => (
              <div key={member.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#102b59] text-lg font-bold text-white">
                  {member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{member.name}</h3>
                <p className="mt-1 text-sm font-medium text-[#102b59] dark:text-[#dfeafe]">{member.role}</p>
                <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{member.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-[#102b59] p-8 text-white shadow-[0_18px_40px_rgba(16,43,89,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f3d385]">Location</p>
          <div className="mt-6 flex items-start gap-3">
            <MapPin className="mt-1 shrink-0 text-[#f3d385]" size={22} />
            <p className="text-xl font-semibold leading-8">{schoolInfo.location}</p>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-200">
            We welcome families and students who value a thoughtful, disciplined, and supportive learning environment.
          </p>
        </div>
      </div>
    </div>
  )
}

function NoticePage({ notices, noticesLoading, isAdmin, onAddNotice, onDeleteNotice, noticeStorageError, noticeLoadError }) {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedNotice, setSelectedNotice] = useState(null)
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false)
  const [imageZoomScale, setImageZoomScale] = useState(1)
  const [uploadedImage, setUploadedImage] = useState('')
  const [uploadedImageFile, setUploadedImageFile] = useState(null)
  const [uploadedImageName, setUploadedImageName] = useState('')
  const [imageUploadError, setImageUploadError] = useState('')
  const [imageInputKey, setImageInputKey] = useState(0)
  const [isSavingNotice, setIsSavingNotice] = useState(false)
  const noticeDialogRef = useRef(null)
  const imageZoomDialogRef = useRef(null)
  const imageZoomViewportRef = useRef(null)
  const imageZoomImageRef = useRef(null)
  const imagePanStartRef = useRef(null)
  const imagePanRef = useRef({ x: 0, y: 0 })
  const lastTouchTapRef = useRef(0)
  const lastTouchZoomRef = useRef(0)

  useEffect(() => {
    const dialog = noticeDialogRef.current
    if (!selectedNotice || !dialog) return undefined

    const previouslyFocused = document.activeElement
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousBodyOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [selectedNotice])

  useEffect(() => {
    const dialog = imageZoomDialogRef.current
    if (!isImageZoomOpen || !dialog) return undefined

    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [isImageZoomOpen])

  const toggleImageZoom = () => {
    if (imageZoomScale > 1) {
      imagePanRef.current = { x: 0, y: 0 }
      imageZoomImageRef.current?.style.setProperty('--image-pan', 'translate3d(0px, 0px, 0)')
      setImageZoomScale(1)
      return
    }

    setImageZoomScale(2)
  }

  const handleImagePanStart = (event) => {
    const isZoomed = imageZoomScale > 1
    if (isZoomed) {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    let maxX = 0
    let maxY = 0
    const viewport = imageZoomViewportRef.current
    const image = imageZoomImageRef.current
    if (isZoomed && viewport && image) {
      const bounds = viewport.getBoundingClientRect()
      const styles = getComputedStyle(viewport)
      const contentWidth = bounds.width - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
      const contentHeight = bounds.height - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
      const fitScale = Math.min(contentWidth / image.naturalWidth, contentHeight / image.naturalHeight)
      maxX = Math.max(0, (image.naturalWidth * fitScale * imageZoomScale - contentWidth) / 2)
      maxY = Math.max(0, (image.naturalHeight * fitScale * imageZoomScale - contentHeight) / 2)
    }

    imagePanStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      panX: imagePanRef.current.x,
      panY: imagePanRef.current.y,
      maxX,
      maxY,
      isZoomed,
      moved: false,
    }
  }

  const handleImagePanMove = (event) => {
    const start = imagePanStartRef.current
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.clientX
    const deltaY = event.clientY - start.clientY
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) start.moved = true
    if (!start.isZoomed) return

    const image = imageZoomImageRef.current
    if (!image) return

    const x = Math.max(-start.maxX, Math.min(start.maxX, start.panX + deltaX))
    const y = Math.max(-start.maxY, Math.min(start.maxY, start.panY + deltaY))
    imagePanRef.current = { x, y }
    image.style.setProperty('--image-pan', `translate3d(${x}px, ${y}px, 0)`)
  }

  const handleImagePanEnd = (event) => {
    const start = imagePanStartRef.current
    if (!start || start.pointerId !== event.pointerId) return

    imagePanStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (event.pointerType !== 'touch' || start.moved) return

    const now = Date.now()
    if (now - lastTouchTapRef.current < 320 && now - lastTouchZoomRef.current > 500) {
      lastTouchZoomRef.current = now
      lastTouchTapRef.current = 0
      toggleImageZoom()
      return
    }
    lastTouchTapRef.current = now
  }

  const filteredNotices = useMemo(() => {
    return notices.filter((notice) => {
      const matchesCategory = category === 'All' || notice.category === category
      const text = `${notice.title} ${notice.summary}`.toLowerCase()
      const matchesQuery = text.includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [category, notices, query])

  const form = useForm({
    resolver: zodResolver(noticeSchema),
    defaultValues: {
      title: '',
      category: 'Academic',
      date: new Date().toISOString().slice(0, 10),
      summary: '',
      image: '',
    },
  })

  const onSubmit = async (values) => {
    setIsSavingNotice(true)
    try {
      const saved = await onAddNotice({
        ...values,
        image: uploadedImageFile ? '' : values.image,
        imageFile: uploadedImageFile,
      })
      if (!saved) return

      setUploadedImage('')
      setUploadedImageFile(null)
      setUploadedImageName('')
      setImageUploadError('')
      setImageInputKey((current) => current + 1)
      form.reset({
        title: '',
        category: 'Academic',
        date: new Date().toISOString().slice(0, 10),
        summary: '',
        image: '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setImageUploadError(`The notice could not be published: ${message}`)
    } finally {
      setIsSavingNotice(false)
    }
  }

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setImageUploadError('Choose a JPG, PNG, or WebP image.')
      event.target.value = ''
      return
    }

    if (file.size > 1024 * 1024) {
      setImageUploadError('Image files must be 1 MB or smaller.')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setImageUploadError('The selected image could not be read. Please try another file.')
        return
      }

      setUploadedImage(reader.result)
      setUploadedImageFile(file)
      setUploadedImageName(file.name)
      setImageUploadError('')
      form.setValue('image', '')
      form.clearErrors('image')
    }
    reader.onerror = () => {
      setImageUploadError('The selected image could not be read. Please try another file.')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Notice board</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white md:text-5xl">Academic and administrative announcements</h1>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_18px_30px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white md:w-64"
            placeholder="Search notices"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {noticeCategories.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              category === option
                ? 'bg-[#102b59] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {isAdmin && (
        <div className="mt-10 space-y-10">
          <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2ff] text-[#102b59]">
                <ImagePlus size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#102b59] dark:text-[#dfeafe]">Admin panel</p>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Add a new notice</h2>
              </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Title</label>
              <input {...form.register('title')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Notice title" />
              {form.formState.errors.title && <p className="mt-2 text-sm text-red-600">{form.formState.errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Category</label>
              <select {...form.register('category')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="Academic">Academic</option>
                <option value="Administrative">Administrative</option>
                <option value="Events">Events</option>
                <option value="Results">Results</option>
              </select>
              {form.formState.errors.category && <p className="mt-2 text-sm text-red-600">{form.formState.errors.category.message}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Date</label>
              <input type="date" {...form.register('date')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              {form.formState.errors.date && <p className="mt-2 text-sm text-red-600">{form.formState.errors.date.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Image URL (optional)</label>
              <input {...form.register('image')} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="https://example.com/school-notice.jpg" />
              {form.formState.errors.image && <p className="mt-2 text-sm text-red-600">{form.formState.errors.image.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notice-image-file" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Or choose an image file
              </label>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">JPG, PNG, or WebP · up to 1 MB</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">The selected file is uploaded to the school notice image store. A file takes priority over an image URL.</p>
                </div>
                <input
                  key={imageInputKey}
                  id="notice-image-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileChange}
                  aria-describedby="notice-image-help notice-image-error"
                  className="min-h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-sm text-slate-700 file:mr-3 file:min-h-11 file:border-0 file:bg-[#edf2ff] file:px-4 file:font-semibold file:text-[#102b59] hover:file:bg-[#dfe8ff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100 sm:w-auto"
                />
              </div>
              <span id="notice-image-help" className="sr-only">Select a JPG, PNG, or WebP image no larger than 1 megabyte.</span>
              {imageUploadError && <p id="notice-image-error" role="alert" className="mt-2 text-sm text-red-600">{imageUploadError}</p>}
              {uploadedImage && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <img src={uploadedImage} alt={`Preview of ${uploadedImageName}`} className="h-16 w-16 rounded-lg object-cover" />
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{uploadedImageName}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedImage('')
                      setUploadedImageFile(null)
                      setUploadedImageName('')
                      setImageInputKey((current) => current + 1)
                    }}
                    className="min-h-11 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Summary</label>
              <textarea {...form.register('summary')} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Write a brief notice summary..." />
              {form.formState.errors.summary && <p className="mt-2 text-sm text-red-600">{form.formState.errors.summary.message}</p>}
            </div>
          </div>

          {noticeStorageError && <p role="alert" className="mt-4 text-sm font-medium text-red-600">{noticeStorageError}</p>}
          <button type="submit" disabled={isSavingNotice} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#102b59] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0d2347] disabled:cursor-wait disabled:opacity-60">
            {isSavingNotice ? 'Publishing…' : 'Publish notice'} <ArrowRight size={16} />
          </button>
        </form>

      </div>
      )}

      {noticeLoadError && <p role="alert" className="mt-8 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-200">{noticeLoadError}</p>}
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredNotices.length > 0 ? (
          filteredNotices.map((notice) => (
            <article key={notice.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_18px_38px_rgba(15,23,42,0.09)] dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setSelectedNotice(notice)}
                aria-label={`Read full notice: ${notice.title}`}
                className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#102b59]"
              >
              {notice.image && (
                  <div className="flex h-44 w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img src={notice.image} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                  </div>
              )}
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102b59] dark:bg-slate-800 dark:text-[#dfeafe]">
                    {notice.category}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <CalendarDays size={14} /> {notice.date}
                  </span>
                  </div>
                  <h3 className="mt-4 line-clamp-2 text-xl font-bold text-slate-900 dark:text-white">{notice.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{notice.summary}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#102b59] dark:text-[#dfeafe]">
                    Read full notice <ArrowRight size={15} />
                  </span>
                </div>
              </button>
              {isAdmin && (
                <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete "${notice.title}"? This cannot be undone.`)) {
                        onDeleteNotice(notice)
                      }
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                    aria-label={`Delete notice: ${notice.title}`}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {noticesLoading ? 'Loading notices…' : 'No notices match your current search.'}
          </div>
        )}
      </div>

      {selectedNotice && (
        <dialog
          ref={noticeDialogRef}
          aria-labelledby="notice-detail-title"
          onClose={() => setSelectedNotice(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) noticeDialogRef.current?.close()
          }}
          className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 sm:p-7 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <span className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#102b59] dark:bg-slate-800 dark:text-[#dfeafe]">
                {selectedNotice.category}
              </span>
              <h2 id="notice-detail-title" className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">{selectedNotice.title}</h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <CalendarDays size={15} /> {selectedNotice.date}
              </p>
            </div>
            <button
              type="button"
              onClick={() => noticeDialogRef.current?.close()}
              aria-label="Close notice"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102b59] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X size={19} />
            </button>
          </div>
          <div className="p-5 sm:p-7">
            {selectedNotice.image && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => {
                    imagePanRef.current = { x: 0, y: 0 }
                    setImageZoomScale(1)
                    setIsImageZoomOpen(true)
                  }}
                  aria-label={`Zoom image for ${selectedNotice.title}`}
                  className="block h-52 w-full cursor-zoom-in overflow-hidden rounded-2xl bg-slate-100 p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#102b59] sm:h-64 dark:bg-slate-800"
                >
                  <img src={selectedNotice.image} alt="" className="h-full w-full object-contain" />
                </button>
              </div>
            )}
            <p className="whitespace-pre-wrap text-base leading-8 text-slate-700 dark:text-slate-200">{selectedNotice.summary}</p>
          </div>
        </dialog>
      )}

      {selectedNotice?.image && (
        <dialog
          ref={imageZoomDialogRef}
          aria-label={`Image viewer: ${selectedNotice.title}`}
          onClose={() => {
            setIsImageZoomOpen(false)
            setImageZoomScale(1)
            imagePanRef.current = { x: 0, y: 0 }
            imageZoomImageRef.current?.style.setProperty('--image-pan', 'translate3d(0px, 0px, 0)')
            imagePanStartRef.current = null
            lastTouchTapRef.current = 0
            lastTouchZoomRef.current = 0
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) imageZoomDialogRef.current?.close()
          }}
          className="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-[24px] border border-slate-700 bg-slate-950 p-0 text-white shadow-2xl backdrop:bg-slate-950/85"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <p className="min-w-0 truncate text-sm font-semibold text-slate-100">{selectedNotice.title}</p>
            <button
              type="button"
              onClick={() => imageZoomDialogRef.current?.close()}
              aria-label="Close image viewer"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X size={19} />
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 border-b border-white/10 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={toggleImageZoom}
              className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={imageZoomScale > 1 ? 'Reset image zoom' : 'Zoom image'}
            >
              {imageZoomScale > 1 ? <ZoomOut size={17} /> : <ZoomIn size={17} />}
              <span>{imageZoomScale > 1 ? 'Fit image' : 'Zoom in'}</span>
            </button>
          </div>
          <div
            ref={imageZoomViewportRef}
            onPointerDown={handleImagePanStart}
            onPointerMove={handleImagePanMove}
            onPointerUp={handleImagePanEnd}
            onPointerCancel={() => { imagePanStartRef.current = null }}
            onDoubleClick={() => {
              if (Date.now() - lastTouchZoomRef.current > 500) toggleImageZoom()
            }}
            className={`flex h-[calc(100vh-10rem)] max-h-[calc(100vh-10rem)] items-center justify-center overflow-hidden p-3 sm:p-5 ${imageZoomScale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
            style={{ touchAction: 'none' }}
          >
            <img
              ref={imageZoomImageRef}
              src={selectedNotice.image}
              alt={`Zoomed image for ${selectedNotice.title}`}
              draggable="false"
              className="max-h-full max-w-full select-none object-contain will-change-transform"
              style={{ transform: `var(--image-pan, translate3d(0px, 0px, 0)) scale(${imageZoomScale})` }}
            />
          </div>
        </dialog>
      )}
    </div>
  )
}

function AdminComplaintsPage({ isAdmin, complaints, isLoading, error, onStatusChange, onDelete, onAdminLoginOpen }) {
  const [filter, setFilter] = useState('all')
  const [busyComplaintId, setBusyComplaintId] = useState('')
  const filteredComplaints = complaints.filter((complaint) => filter === 'all' || complaint.status === filter)

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#102b59] dark:bg-slate-800 dark:text-[#dfeafe]">
          <ShieldCheck size={26} />
        </div>
        <h1 className="mt-6 text-3xl font-black text-slate-900 dark:text-white">Admin sign-in required</h1>
        <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300">Sign in with the school administrator account to access private complaints.</p>
        <button
          type="button"
          onClick={onAdminLoginOpen}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#f3b239] px-6 py-3 text-sm font-bold text-[#102b59] transition hover:bg-[#efaa2d]"
        >
          Portal Login
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Admin portal</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white md:text-5xl">Complaints inbox</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">Review private submissions, view evidence images, and update each complaint’s status.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span className="font-bold text-slate-900 dark:text-white">{complaints.length}</span> total ·{' '}
          <span className="font-bold text-amber-700 dark:text-amber-300">{complaints.filter((complaint) => complaint.status === 'new').length}</span> new
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3" aria-label="Filter complaints">
        {[
          { value: 'all', label: 'All' },
          { value: 'new', label: 'New' },
          { value: 'resolved', label: 'Resolved' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === option.value
                ? 'bg-[#102b59] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-6 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}

      <div className="mt-8 space-y-5">
        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300" role="status">
            Loading complaints…
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            {complaints.length === 0 ? 'No complaints have been submitted yet.' : 'No complaints match this filter.'}
          </div>
        ) : (
          filteredComplaints.map((complaint) => (
            <article key={complaint.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{complaint.name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                      complaint.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                    }`}>
                      {complaint.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {complaint.type} · {new Date(complaint.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyComplaintId === complaint.id}
                    onClick={async () => {
                      setBusyComplaintId(complaint.id)
                      await onStatusChange(complaint.id, complaint.status === 'resolved' ? 'new' : 'resolved')
                      setBusyComplaintId('')
                    }}
                    className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {busyComplaintId === complaint.id ? 'Saving…' : complaint.status === 'resolved' ? 'Reopen' : 'Mark resolved'}
                  </button>
                  <button
                    type="button"
                    disabled={busyComplaintId === complaint.id}
                    onClick={async () => {
                      if (!window.confirm('Delete this complaint and its attached images? This cannot be undone.')) return
                      setBusyComplaintId(complaint.id)
                      await onDelete(complaint.id)
                      setBusyComplaintId('')
                    }}
                    className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-4 break-all text-sm font-medium text-[#102b59] dark:text-[#dfeafe]">
                {complaint.contact}
              </p>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-200">{complaint.message}</p>

              {complaint.images.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {complaint.images.map((image) => (
                    <a key={image.path} href={image.url} target="_blank" rel="noreferrer" aria-label={`Open complaint attachment from ${complaint.name}`}>
                      <img src={image.url} alt={`Complaint attachment from ${complaint.name}`} loading="lazy" className="h-28 w-full rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}

function ComplainPage({ onSubmitComplaint }) {
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    type: '',
    message: '',
  })
  const [attachments, setAttachments] = useState([])
  const attachmentUrlsRef = useRef(new Set())

  useEffect(() => () => {
    attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const updateField = (field, value) => {
    setSubmitted(false)
    setFormError('')
    setFormData((current) => ({ ...current, [field]: value }))
  }

  const handleAttachments = (event) => {
    const files = Array.from(event.target.files || [])
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const error = files.some((file) => !allowedTypes.includes(file.type))
      ? 'Choose JPG, PNG, or WebP images only.'
      : files.some((file) => file.size > 1024 * 1024)
        ? 'Each image must be no larger than 1 MB.'
        : attachments.length + files.length > 4
          ? 'You can attach up to 4 images.'
          : ''

    event.target.value = ''
    if (error) {
      setFormError(error)
      return
    }

    setSubmitted(false)
    setFormError('')
    setAttachments((current) => [
      ...current,
      ...files.map((file) => {
        const url = URL.createObjectURL(file)
        attachmentUrlsRef.current.add(url)
        return { file, url }
      }),
    ])
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFormError('')
    setSubmitted(false)

    try {
      const result = await onSubmitComplaint({
        ...formData,
        attachments: attachments.map(({ file }) => file),
      })
      if (result?.error) {
        setFormError(result.error)
        return
      }

      setSubmitted(true)
      setFormData({ name: '', contact: '', type: '', message: '' })
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      attachmentUrlsRef.current.clear()
      setAttachments([])
    } catch (error) {
      setFormError(`Your complaint could not be submitted: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Complain</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white md:text-5xl">Share your concern with the school</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300">
            Share a concern or complaint with the school office. Submissions are private and visible only to an authorized school administrator.
          </p>

          <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Reach the office</p>
            <ul className="mt-5 space-y-4 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex gap-3"><MapPin size={18} className="mt-0.5 text-[#102b59] dark:text-[#dfeafe]" /> {schoolInfo.location}</li>
              <li className="flex gap-3"><Phone size={18} className="mt-0.5 text-[#102b59] dark:text-[#dfeafe]" /> {schoolInfo.phone}</li>
              <li className="flex gap-3"><Mail size={18} className="mt-0.5 text-[#102b59] dark:text-[#dfeafe]" /> {schoolInfo.email}</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="complaint-name" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Full name</label>
              <input
                id="complaint-name"
                required
                minLength={2}
                maxLength={120}
                value={formData.name}
                onChange={(event) => updateField('name', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="complaint-contact" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Phone or email</label>
              <input
                id="complaint-contact"
                required
                minLength={3}
                maxLength={200}
                value={formData.contact}
                onChange={(event) => updateField('contact', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Contact details"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="complaint-category" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Complaint type</label>
              <select
                id="complaint-category"
                required
                value={formData.type}
                onChange={(event) => updateField('type', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                <option value="">Select a category</option>
                <option value="Academic">Academic</option>
                <option value="Facilities">Facilities</option>
                <option value="Behavior">Behavior</option>
                <option value="Administration">Administration</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="complaint-message" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Your message</label>
              <textarea
                id="complaint-message"
                required
                minLength={10}
                maxLength={5000}
                rows="6"
                value={formData.message}
                onChange={(event) => updateField('message', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Please describe the issue clearly so the school can help you."
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="complaint-images" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Attach images (optional)</label>
              <input
                id="complaint-images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleAttachments}
                aria-describedby="complaint-image-help"
                className="w-full cursor-pointer rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#edf2ff] file:px-4 file:py-2 file:font-semibold file:text-[#102b59] hover:file:bg-[#dfe8ff] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:file:bg-slate-800 dark:file:text-slate-100"
              />
              <p id="complaint-image-help" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Up to 4 JPG, PNG, or WebP images, 1 MB each.</p>
              {attachments.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {attachments.map((attachment) => (
                    <div key={attachment.url} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                      <img src={attachment.url} alt={`Preview of ${attachment.file.name}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(attachment.url)
                          attachmentUrlsRef.current.delete(attachment.url)
                          setAttachments((current) => current.filter((item) => item.url !== attachment.url))
                        }}
                        aria-label={`Remove ${attachment.file.name}`}
                        className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-700 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Your message and any attached images are sent securely to the school.</p>
            <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#f3b239] px-6 py-3 text-sm font-bold text-[#102b59] transition hover:bg-[#efaa2d] disabled:cursor-wait disabled:opacity-60">
              {isSubmitting ? 'Submitting…' : 'Submit complaint'}
            </button>
          </div>

          {formError && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">{formError}</p>}
          {submitted && (
            <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              Your complaint was submitted successfully. The school office will review it.
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

function ContactPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Contact</p>
          <h1 className="mt-3 text-4xl font-black text-slate-900 dark:text-white md:text-5xl">We’re here to help.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
            For admissions, school visits, or general inquiries, our office is ready to guide you.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <MapPin className="mt-1 text-[#102b59] dark:text-[#dfeafe]" size={20} />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Location</p>
                <p className="text-slate-600 dark:text-slate-300">{schoolInfo.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Phone className="mt-1 text-[#102b59] dark:text-[#dfeafe]" size={20} />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Phone</p>
                <p className="text-slate-600 dark:text-slate-300">{schoolInfo.phone}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <Mail className="mt-1 text-[#102b59] dark:text-[#dfeafe]" size={20} />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Email</p>
                <p className="text-slate-600 dark:text-slate-300">{schoolInfo.email}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">School leadership</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Meet the administration</h2>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-[#102b59] dark:text-[#dfeafe]">Principal</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{schoolInfo.principal}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm font-medium text-[#102b59] dark:text-[#dfeafe]">Co-Principal</p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{schoolInfo.coPrincipal}</p>
            </div>

            <div className="rounded-2xl bg-[#102b59] p-5 text-white">
              <p className="text-sm font-medium text-[#f3d385]">School office</p>
              <p className="mt-2 text-base leading-7 text-slate-200">
                We welcome visits from students and families seeking guidance and admissions information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LoginModal({ isOpen, onClose, onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const result = await onSubmit(email.trim(), password)
      if (result?.error) {
        setError(result.error)
        return
      }

      setEmail('')
      setPassword('')
      setError('')
      onClose()
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : String(submitError)
      setError(`Unable to sign in: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#102b59] dark:text-[#dfeafe]">Secure portal</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Administrator login</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300">
            <X size={16} />
          </button>
        </div>

        {!supabase && (
          <p role="status" className="mt-5 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Secure admin login is not configured yet. Connect Supabase before publishing notices.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 outline-none focus:border-[#102b59] dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="Enter administrator email"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#102b59] dark:border-slate-700 dark:bg-slate-950">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full bg-transparent text-slate-800 outline-none dark:text-white"
                placeholder="Enter password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 min-h-11 min-w-11 text-xs font-semibold uppercase tracking-[0.12em] text-[#102b59] dark:text-[#dfeafe]">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-200">{error}</p>}

          <button type="submit" disabled={!supabase || isSubmitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#102b59] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0d2347] disabled:cursor-not-allowed disabled:opacity-60">
            <ShieldCheck size={16} /> {isSubmitting ? 'Signing in…' : 'Login securely'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default App
