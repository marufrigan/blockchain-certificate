"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import CopyButton from "@/components/CopyButton";
import Timeline from "@/components/Timeline";
import { useAuth } from "@/context/AuthContext";

type CertDetailResponse = {
  certificate: Record<string, unknown>;
  history: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
};

export default function CertificateDetailPage({ params }: { params: { id: string } }) {
  const { token } = useAuth();
  const [data, setData] = useState<CertDetailResponse | null>(null);
  const [publicData, setPublicData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api<Record<string, unknown>>(`/api/certificates/verify/${params.id}`)
      .then(setPublicData)
      .catch(() => null);

    if (token) {
      api<CertDetailResponse>(`/api/certificates/${params.id}`, {}, token)
        .then(setData)
        .catch(() => null);
    }
  }, [params.id, token]);

  const cert = data?.certificate || (publicData?.certificate as Record<string, unknown>);
  const status = String(cert?.status || (publicData?.certificate as { status?: string })?.status || "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/verify" className="text-sm text-academic-600 hover:underline">
        ← Back to verification
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-bold">Certificate Details</h1>
      <p className="mt-2 font-mono text-sm text-slate-600">
        {params.id} <CopyButton value={params.id} />
      </p>

      {cert ? (
        <div className="card mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{String(cert.student_name || cert.studentName)}</h2>
            <StatusBadge status={status} />
          </div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Degree</dt>
              <dd>{String(cert.degree)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Department</dt>
              <dd>{String(cert.department)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Student ID</dt>
              <dd>{String(cert.student_id || cert.studentId)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Version</dt>
              <dd>v{String(cert.version_number || cert.versionNumber)}</dd>
            </div>
          </dl>
          {data?.transactions?.[0] && (
            <div className="mt-4">
              <p className="text-xs text-slate-500">Transaction hash</p>
              <p className="break-all font-mono text-xs">{String(data.transactions[0].tx_hash)}</p>
              <CopyButton value={String(data.transactions[0].tx_hash)} />
            </div>
          )}
          <Link href={`/certificates/${params.id}/history`} className="btn-secondary mt-6 inline-block">
            View audit trail
          </Link>
        </div>
      ) : (
        <p className="mt-8 text-slate-500">Loading or certificate not found...</p>
      )}
    </div>
  );
}
