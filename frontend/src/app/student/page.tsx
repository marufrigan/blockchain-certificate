"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export default function StudentDashboardPage() {
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState<{ certificate?: { status: string } } | null>(null);

  const search = async () => {
    const data = await api<{ certificate?: { status: string } }>(
      `/api/certificates/verify/${studentId}`
    ).catch(() => null);
    setResult(data);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-serif text-3xl font-bold">Student Certificates</h1>
      <p className="mt-2 text-sm text-slate-600">
        View-only lookup by certificate ID. Enter IDs issued to you.
      </p>
      <div className="mt-6 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Certificate ID"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <button onClick={search} className="btn-primary">
          Lookup
        </button>
      </div>
      {result && (
        <div className="card mt-8">
          <Link href={`/verify?id=${studentId}`} className="font-mono text-sm text-academic-600">
            {studentId}
          </Link>
          {result.certificate && (
            <div className="mt-2">
              <StatusBadge status={result.certificate.status} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
