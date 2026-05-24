"use client";

import toast from "react-hot-toast";

export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };
  return (
    <button type="button" onClick={copy} className="text-xs font-medium text-academic-600 hover:underline">
      {label}
    </button>
  );
}
