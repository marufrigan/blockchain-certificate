"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Timeline from "@/components/Timeline";

type VerifyHistoryResponse = {
  history?: { database: unknown[]; blockchain: unknown[] };
  certificate?: { status: string };
};

export default function CertificateHistoryPage({ params }: { params: { id: string } }) {
  const [verify, setVerify] = useState<VerifyHistoryResponse | null>(null);

  useEffect(() => {
    api<VerifyHistoryResponse>(`/api/certificates/verify/${params.id}`).then(setVerify);
  }, [params.id]);

  const timelineItems = [
    ...(verify?.history?.blockchain as { certificateId: string; status: string; versionNumber: number }[] || []).map(
      (h) => ({
        certificateId: h.certificateId,
        status: h.status,
        action: `On-chain v${h.versionNumber}`,
      })
    ),
    ...(verify?.history?.database as { action: string; created_at: string; reason?: string }[] || []).map((h) => ({
      action: h.action,
      created_at: h.created_at,
      reason: h.reason,
    })),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href={`/certificates/${params.id}`} className="text-sm text-academic-600 hover:underline">
        ← Certificate details
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-bold">Audit Trail</h1>
      <p className="font-mono text-sm text-slate-600">{params.id}</p>
      <div className="card mt-8">
        <Timeline items={timelineItems} />
      </div>
    </div>
  );
}
