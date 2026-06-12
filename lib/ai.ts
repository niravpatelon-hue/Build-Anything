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
