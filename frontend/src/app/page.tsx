import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-academic-50 to-slate-50">
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-academic-600">
          TrustCert · Research Prototype
        </p>
        <h1 className="mt-4 font-serif text-4xl font-bold text-academic-900 md:text-5xl">
          Revocable Blockchain-Based
          <br />
          Academic Certificate Management
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Issue, verify, revoke, and replace academic credentials on Polygon Amoy with immutable audit
          trails. Full certificate lifecycle control for universities and public verifiers.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/verify" className="btn-primary px-8 py-3">
            Verify a Certificate
          </Link>
          <Link href="/admin/login" className="btn-secondary px-8 py-3">
            University Admin
          </Link>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl gap-6 text-left md:grid-cols-2">
          {[
            {
              title: "Issue",
              desc: "Mint certificates on-chain with IPFS-backed PDF hashes and PostgreSQL metadata.",
            },
            {
              title: "Verify",
              desc: "Public verification shows ACTIVE, REVOKED, REPLACED, or SUPERSEDED status instantly.",
            },
            {
              title: "Revoke",
              desc: "Invalidate credentials with on-chain reason — data remains for audit.",
            },
            {
              title: "Replace",
              desc: "Link old and new certificate IDs with version history and superseded states.",
            },
          ].map((f) => (
            <div key={f.title} className="card">
              <h3 className="font-semibold text-academic-800">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center font-serif text-2xl font-bold text-academic-900">
            Certificate Lifecycle
          </h2>
          <pre className="mt-8 overflow-x-auto rounded-xl bg-slate-900 p-6 text-xs text-emerald-300">
{`ACTIVE ──revoke──► REVOKED
  │
  └──replace──► REPLACED ──► new ACTIVE (v+1)
                      └── earlier versions → SUPERSEDED`}
          </pre>
        </div>
      </section>
    </div>
  );
}
