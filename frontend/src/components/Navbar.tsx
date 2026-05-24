"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-serif text-xl font-bold text-academic-900">
          TrustCert
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link href="/verify" className="hover:text-academic-600">
            Verify
          </Link>
          <Link href="/student" className="hover:text-academic-600">
            Student
          </Link>
          {user ? (
            <>
              <Link href="/admin/dashboard" className="hover:text-academic-600">
                Dashboard
              </Link>
              <button onClick={logout} className="text-slate-500 hover:text-red-600">
                Logout
              </button>
            </>
          ) : (
            <Link href="/admin/login" className="btn-primary">
              Admin Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
