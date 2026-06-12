import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import mammoth from "mammoth";

/** Thrown when ANTHROPIC_API_KEY hasn't been added to the environment yet. */
export class AINotConfiguredError extends Error {
  constructor() {
    super("The AI isn't connected yet — set ANTHROPIC_API_KEY.");
    this.name = "AINotConfiguredError";
  }
}

export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AINotConfiguredError();
  return new Anthropic();
}

const ResumeProfile = z.object({
  name: z.string().describe("Candidate's full name"),
  email: z.string().describe("Email address, or empty string if not present"),
  phone: z.string().describe("Phone number, or empty string if not present"),
  location: z
    .string()
    .describe("City and country the candidate is based in, or empty string"),
  headline: z
    .string()
    .describe("One-line professional headline, e.g. 'Senior Data Analyst'"),
  summary: z
    .string()
    .describe("Two to three sentence professional summary of the candidate"),
  skills: z
    .array(z.string())
    .describe("Skills, tools and technologies found in the resume"),
  suggested_titles: z
    .array(z.string())
    .describe(
      "Three to six job titles this candidate is well suited to search for"
    ),
  experience: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        period: z.string().describe("e.g. 'Jan 2021 – Mar 2024'"),
        description: z.string().describe("One-line summary of the role"),
      })
    )
    .describe("Work history, most recent first"),
  education: z.array(
    z.object({
      degree: z.string(),
      school: z.string(),
      year: z.string(),
    })
  ),
});

export type ParsedResume = z.infer<typeof ResumeProfile>;

/**
 * Reads a resume file (PDF, DOCX or TXT) with Claude and returns the
 * candidate's structured profile information.
 */
export async function parseResume(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ParsedResume> {
  const client = getAnthropic();
  const lower = filename.toLowerCase();

  let fileBlock: Anthropic.ContentBlockParam;
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    fileBlock = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: buffer.toString("base64"),
      },
    };
  } else if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    fileBlock = { type: "text", text: `Resume file contents:\n\n${value}` };
  } else if (lower.endsWith(".txt")) {
    fileBlock = {
      type: "text",
      text: `Resume file contents:\n\n${buffer.toString("utf-8")}`,
    };
  } else {
    throw new Error(
      "That file type isn't supported — upload a PDF, DOCX or TXT resume."
    );
  }

  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(ResumeProfile) },
    messages: [
      {
        role: "user",
        content: [
          fileBlock,
          {
            type: "text",
            text: "Extract this candidate's information from their resume to build a job-application profile. Use empty strings or empty arrays for anything genuinely missing — never invent facts that are not in the resume.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(
      "The resume couldn't be read automatically — fill the profile in by hand, or try a different file."
    );
  }
  return response.parsed_output;
}

const FitAnalysis = z.object({
  match_score: z
    .number()
    .describe("How well the candidate fits this job, 0-100"),
  strengths: z
    .array(z.string())
    .describe("Up to 3 strengths for this job, one short sentence each"),
  gaps: z
    .array(z.string())
    .describe("Up to 3 gaps or risks, one short sentence each"),
  fixes: z
    .array(z.string())
    .describe(
      "3 to 5 concrete resume edits to make for this job, one short imperative sentence each, e.g. 'Lead with the dashboard project in your summary'"
    ),
});

export type Analysis = z.infer<typeof FitAnalysis>;

function profileBlock(profile: Record<string, string>): string {
  return [
    `Name: ${profile.name}`,
    `Headline: ${profile.headline}`,
    `Location: ${profile.location}`,
    `Summary: ${profile.summary}`,
    `Skills: ${profile.skills}`,
    `Experience: ${profile.experience}`,
    `Education: ${profile.education}`,
  ].join("\n");
}

function jobBlock(job: Record<string, string>): string {
  return [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}`,
    `Description: ${job.description}`,
  ].join("\n");
}

/** Compares the candidate's profile with a job and suggests resume fixes. */
export async function analyzeFit(
  profile: Record<string, string>,
  job: Record<string, string>
): Promise<Analysis> {
  const client = getAnthropic();
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(FitAnalysis) },
    messages: [
      {
        role: "user",
        content: `You are helping a job seeker decide how to tailor their resume for a specific job.\n\nCANDIDATE PROFILE (extracted from their resume):\n${profileBlock(profile)}\n\nJOB:\n${jobBlock(job)}\n\nAssess the fit and suggest the most impactful resume edits for THIS job. Keep every item to one short sentence. Be honest about gaps — never invent experience the candidate doesn't have.`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("The fit check didn't complete — try again.");
  }
  return response.parsed_output;
}

const TailoredDocs = z.object({
  tailored_resume: z
    .string()
    .describe(
      "The full tailored resume as plain text with UPPERCASE section headings (SUMMARY, SKILLS, EXPERIENCE, EDUCATION). ATS-friendly, no tables."
    ),
  cover_letter: z
    .string()
    .describe(
      "A complete, ready-to-send cover letter for this job, 250-350 words, plain text"
    ),
});

export type Tailored = z.infer<typeof TailoredDocs>;

/** Writes the job-specific resume (with the fixes applied) and cover letter. */
export async function tailorDocuments(
  profile: Record<string, string>,
  job: Record<string, string>,
  fixes: string[]
): Promise<Tailored> {
  const client = getAnthropic();
  const response = await client.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(TailoredDocs) },
    messages: [
      {
        role: "user",
        content: `Write a tailored resume and cover letter for this application.\n\nCANDIDATE PROFILE:\n${profileBlock(profile)}\n\nJOB:\n${jobBlock(job)}\n\nAGREED RESUME FIXES TO APPLY:\n${fixes.map((f) => `- ${f}`).join("\n")}\n\nRules: use only facts from the candidate profile — never invent employers, dates, degrees or numbers. Reframe and reorder to emphasise what this job values. The cover letter should sound like a real person, reference the company by name, and avoid clichés like "I am writing to express".`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Document generation didn't complete — try again.");
  }
  return response.parsed_output;
}
