import Link from 'next/link';
import { CreditCard, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white selection:bg-indigo-500/30">

      {/* Navbar */}
      <nav className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">NFC Discount</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="rounded-full bg-white/10 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/20">
            Sign In
          </Link>
          <Link href="/dashboard" className="hidden sm:block rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500">
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-8 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-400">
          <span className="mr-2 flex h-2 w-2 relative">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
          </span>
          v1.1 Now Available
        </div>

        <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl">
          Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">NFC Discount</span> Management
        </h1>

        <p className="mt-8 max-w-2xl text-lg text-zinc-400">
          Seamlessly manage customer cards, track transactions, and apply discounts with our high-performance NFC middleware system.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link href="/dashboard" className="group flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-bold text-zinc-950 transition hover:bg-zinc-200">
            <Zap className="h-5 w-5 transition group-hover:scale-110" />
            Get Started
          </Link>
          <Link href="/login" className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3.5 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/10">
            Admin Login
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-8 sm:grid-cols-3">
          <FeatureCard
            icon={<CreditCard className="h-6 w-6 text-indigo-400" />}
            title="Smart NFC Cards"
            description="Issue and manage NFC cards with secure encryption and instant reading capabilities."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6 text-emerald-400" />}
            title="Instant Transactions"
            description="Process discounts in milliseconds with our optimized local C# middleware."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6 text-rose-400" />}
            title="Secure & Reliable"
            description="Enterprise-grade security for customer data and transaction logs."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} NFC Discount System. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="group rounded-3xl border border-white/5 bg-white/5 p-8 text-left transition hover:border-white/10 hover:bg-white/10">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 shadow-inner">
        {icon}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
      <p className="text-zinc-400">{description}</p>
    </div>
  );
}
