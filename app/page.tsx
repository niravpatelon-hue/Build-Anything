export default function Home() {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Stop applying to jobs one by one.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">
        Set up your profile once. When a job that matches your skills and
        preferences shows up, the portal applies for you — automatically.
      </p>
      <div className="mt-8 flex gap-3">
        <a
          href="/profile"
          className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          Set up my profile
        </a>
        <a
          href="/jobs"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:border-indigo-400"
        >
          Browse jobs
        </a>
      </div>
      <div className="mt-12 grid w-full gap-4 sm:grid-cols-3">
        {[
          ["📋", "Browse jobs", "See every open role in one place.", "/jobs"],
          ["👤", "One profile", "Your details and resume, saved once.", "/profile"],
          ["⚡", "Auto-apply", "Matching jobs get your application instantly.", "/applications"],
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
