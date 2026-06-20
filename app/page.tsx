export default function Home() {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        A resume tailored to every job — before you apply.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">
        Set up your profile once. For each job, the portal checks your fit and
        writes a tailored resume and cover letter — then you apply when it&apos;s
        ready, one click or in bulk.
      </p>
      <div className="mt-8 flex gap-3">
        <a
          href="/profile"
          className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Set up my profile
        </a>
        <a
          href="/search"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:border-indigo-400"
        >
          Find jobs
        </a>
      </div>
      <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
        {[
          ["🔎", "Search the web", "Jobs from LinkedIn, Indeed, Glassdoor and more.", "/search"],
          ["✍️", "Tailored per job", "A fit check, resume and cover letter for each role.", "/applications"],
          ["⚡", "Apply in bulk", "Fire off everything you've prepared in one click.", "/applications"],
        ].map(([icon, title, text, href]) => (
          <a
            key={title}
            href={href}
            className="rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-indigo-300"
          >
            <div className="text-2xl">{icon}</div>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
