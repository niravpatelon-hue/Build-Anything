export function SetupNotice() {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
      <h2 className="font-semibold">⚙️ Database not connected yet</h2>
      <p className="mt-2 text-sm">
        This page needs the Google connection to be finished. Add the three
        Google credentials as environment variables in Vercel, redeploy, and
        this page will come alive — no code changes needed.
      </p>
    </div>
  );
}

export function Flash({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const messages: { tone: "good" | "bad"; text: string }[] = [];

  if (searchParams.error === "setup") {
    messages.push({
      tone: "bad",
      text: "The database isn't connected yet — finish the Google setup in Vercel first.",
    });
  } else if (searchParams.error) {
    messages.push({ tone: "bad", text: searchParams.error });
  }
  if (searchParams.posted) {
    const auto = Number(searchParams.auto ?? 0);
    messages.push({
      tone: "good",
      text:
        auto > 0
          ? `Job posted — and queued as a draft for ${auto} matching candidate${auto === 1 ? "" : "s"} to prepare. ⚡`
          : "Job posted.",
    });
  }
  if (searchParams.applied) {
    messages.push({ tone: "good", text: searchParams.applied });
  }
  if (searchParams.parsed) {
    const auto = Number(searchParams.auto ?? 0);
    const isDemo = searchParams.parsed === "demo";
    const autoText =
      auto > 0
        ? ` — queued ${auto} matching job${auto === 1 ? "" : "s"} as drafts to prepare ⚡`
        : "";
    messages.push({
      tone: "good",
      text: isDemo
        ? `Profile filled with sample data${autoText}. In the real version, Claude reads your actual resume here.`
        : `Resume read and profile filled in${autoText}. Check the details below and save any tweaks.`,
    });
  }
  if (searchParams.prepared !== undefined) {
    const n = Number(searchParams.prepared);
    messages.push(
      n > 0
        ? {
            tone: "good",
            text: `⚡ Queued ${n} matching job${n === 1 ? "" : "s"} as drafts — curate and apply each from below.`,
          }
        : {
            tone: "good",
            text: "No new matches to prepare — everything that fits is already in your applications.",
          }
    );
  }
  if (searchParams.submitted_all !== undefined) {
    const n = Number(searchParams.submitted_all);
    messages.push(
      n > 0
        ? {
            tone: "good",
            text: `✅ Applied to ${n} ready application${n === 1 ? "" : "s"} — open each posting to attach your curated documents.`,
          }
        : {
            tone: "good",
            text: "Nothing was ready to apply yet — prepare an application's documents first.",
          }
    );
  }
  if (searchParams.analyzed) {
    messages.push({
      tone: "good",
      text: "Fit check complete 🔍 — review the suggested fixes below.",
    });
  }
  if (searchParams.docs) {
    messages.push({
      tone: "good",
      text: "Tailored resume and cover letter are ready ✍️ — apply when you're set.",
    });
  }
  if (searchParams.status_saved) {
    messages.push({ tone: "good", text: "Status updated." });
  }
  if (searchParams.demo) {
    messages.push({
      tone: "good",
      text: "You're in — this is the demo account. Try uploading any file as a resume and watch the profile build itself.",
    });
  }
  if (searchParams.saved) {
    const auto = Number(searchParams.auto ?? 0);
    messages.push({
      tone: "good",
      text:
        auto > 0
          ? `Profile saved — queued ${auto} matching job${auto === 1 ? "" : "s"} as drafts to prepare. ⚡`
          : "Profile saved.",
    });
  }

  if (messages.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {messages.map((m, i) => (
        <p
          key={i}
          className={`rounded-lg border px-4 py-3 text-sm ${
            m.tone === "good"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {m.text}
        </p>
      ))}
    </div>
  );
}
