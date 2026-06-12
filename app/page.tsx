export default function Home() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-6 rounded-full bg-indigo-100 px-4 py-1 text-sm font-medium text-indigo-700">
        🚧 Under construction — first version coming together
      </span>
      <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
        Stop applying to jobs one by one.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-slate-600">
        Set up your profile once. When a job that matches your skills and
        preferences shows up, the portal applies for you — automatically.
      </p>
      <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
        {[
          ["📋", "Browse jobs", "See every open role in one place."],
          ["👤", "One profile", "Your details and resume, saved once."],
          ["⚡", "Auto-apply", "Matching jobs get your application instantly."],
        ].map(([icon, title, text]) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm"
          >
            <div className="text-2xl">{icon}</div>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
