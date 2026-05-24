import { Suspense } from "react";
import VerifyContent from "./VerifyContent";

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Loading verification...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
