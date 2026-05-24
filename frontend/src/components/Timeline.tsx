import StatusBadge from "./StatusBadge";

interface TimelineItem {
  certificateId?: string;
  action?: string;
  status?: string;
  created_at?: string;
  reason?: string;
  versionNumber?: number;
}

export default function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-500">No history available.</p>;
  }

  return (
    <ol className="relative border-l border-slate-200 pl-6">
      {items.map((item, i) => (
        <li key={i} className="mb-6 ml-2">
          <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-academic-500 ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">
              {item.action || item.certificateId || `Version ${item.versionNumber}`}
            </span>
            {item.status && <StatusBadge status={item.status} />}
          </div>
          {item.created_at && (
            <p className="mt-1 text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</p>
          )}
          {item.reason && <p className="mt-1 text-sm text-red-700">Reason: {item.reason}</p>}
          {item.certificateId && (
            <p className="mt-1 font-mono text-xs text-slate-600">{item.certificateId}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
