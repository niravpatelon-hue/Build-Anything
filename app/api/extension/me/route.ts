import { NextResponse } from "next/server";
import { getProfileByToken, listApplicationsForEmail } from "@/lib/data";
import {
  DEMO_JOBS,
  DEMO_PARSED,
  demoActive,
  demoTailoredDocs,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

// Access requires the per-user secret token, so a permissive origin is safe
// and lets the extension call this from any browser context.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function readToken(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("token")?.trim() ?? "";
}

/** Sample payload so the extension can be tried before Google is connected. */
function demoPayload() {
  const sample = [DEMO_JOBS[0], DEMO_JOBS[1]];
  return {
    demo: true,
    profile: {
      name: DEMO_PARSED.name,
      email: DEMO_PARSED.email,
      phone: DEMO_PARSED.phone,
      location: DEMO_PARSED.location,
      headline: DEMO_PARSED.headline,
      summary: DEMO_PARSED.summary,
      skills: DEMO_PARSED.skills.join(", "),
    },
    applications: sample.map((job, i) => {
      const docs = demoTailoredDocs(DEMO_PARSED.name, job.title, job.company);
      return {
        id: `demo-${i}`,
        job_title: job.title,
        company: job.company,
        status: "ready",
        apply_link: "",
        resume_text: docs.tailored_resume,
        cover_letter_text: docs.cover_letter,
        resume_link: "",
        cover_letter_link: "",
      };
    }),
  };
}

export async function GET(req: Request) {
  const token = readToken(req);
  if (!token) {
    return json({ error: "Missing token. Add it in the extension options." }, 401);
  }

  if (demoActive) {
    if (token === "demo") return json(demoPayload());
    return json(
      { error: "The portal is in demo mode — use the token \"demo\"." },
      401
    );
  }

  try {
    const profile = await getProfileByToken(token);
    if (!profile) {
      return json({ error: "Token not recognised. Regenerate it in My Profile." }, 401);
    }
    const apps = await listApplicationsForEmail(profile.email);
    return json({
      demo: false,
      profile: {
        name: profile.name ?? "",
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        location: profile.location ?? "",
        headline: profile.headline ?? "",
        summary: profile.summary ?? "",
        skills: profile.skills ?? "",
      },
      applications: apps.map((a) => ({
        id: a.id,
        job_title: a.job_title ?? "",
        company: a.company ?? "",
        status: a.status ?? "",
        apply_link: a.apply_link ?? "",
        resume_text: a.tailored_resume_text ?? "",
        cover_letter_text: a.cover_letter_text ?? "",
        resume_link: a.tailored_resume_link ?? "",
        cover_letter_link: a.cover_letter_link ?? "",
      })),
    });
  } catch {
    return json({ error: "Couldn't reach the portal database." }, 500);
  }
}
