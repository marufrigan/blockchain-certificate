const styles: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REVOKED: "bg-red-100 text-red-800 border-red-200",
  REPLACED: "bg-amber-100 text-amber-800 border-amber-200",
  SUPERSEDED: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        styles[status] || styles.SUPERSEDED
      }`}
    >
      {status}
    </span>
  );
}
