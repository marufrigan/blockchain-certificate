"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGuard from "@/components/AdminGuard";
import WalletConnect from "@/components/WalletConnect";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [certs, setCerts] = useState<Record<string, unknown>[]>([]);
  const [analytics, setAnalytics] = useState<{
    totalCertificates: number;
    byStatus: { status: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ certificates: Record<string, unknown>[] }>("/api/certificates", {}, token).then((d) =>
      setCerts(d.certificates)
    );
    api<{ totalCertificates: number; byStatus: { status: string; count: number }[] }>(
      "/api/analytics/dashboard",
      {},
      token
    ).then(setAnalytics);
  }, [token]);

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-academic-900">TrustCert Admin Dashboard</h1>
            <p className="text-slate-600">
              {user?.fullName} · {user?.universityName || user?.role}
            </p>
          </div>
          <WalletConnect onConnected={() => {}} />
        </div>

        {analytics && (
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="card">
              <p className="text-sm text-slate-500">Total certificates</p>
              <p className="text-3xl font-bold text-academic-800">{analytics.totalCertificates}</p>
            </div>
            {analytics.byStatus.map((s) => (
              <div key={s.status} className="card">
                <StatusBadge status={s.status} />
                <p className="mt-2 text-2xl font-bold">{s.count}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link href="/admin/issue" className="card hover:border-academic-300">
            <h3 className="font-semibold">Issue Certificate</h3>
            <p className="mt-1 text-sm text-slate-600">Create new on-chain credential</p>
          </Link>
          <Link href="/admin/revoke" className="card hover:border-red-300">
            <h3 className="font-semibold">Revoke</h3>
            <p className="mt-1 text-sm text-slate-600">Invalidate active certificate</p>
          </Link>
          <Link href="/admin/replace" className="card hover:border-amber-300">
            <h3 className="font-semibold">Replace</h3>
            <p className="mt-1 text-sm text-slate-600">Issue new version linked to old</p>
          </Link>
        </div>

        <div className="card mt-10 overflow-x-auto">
          <h2 className="font-semibold text-academic-800">Recent certificates</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2">ID</th>
                <th>Student</th>
                <th>Degree</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={String(c.certificate_id)} className="border-b border-slate-100">
                  <td className="py-3 font-mono text-xs">{String(c.certificate_id)}</td>
                  <td>{String(c.student_name)}</td>
                  <td>{String(c.degree)}</td>
                  <td>
                    <StatusBadge status={String(c.status)} />
                  </td>
                  <td>
                    <Link href={`/certificates/${c.certificate_id}`} className="text-academic-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  );
}
