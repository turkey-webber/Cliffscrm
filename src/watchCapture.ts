/** Apple Watch Shortcut → CliffsCRM meeting capture helpers (no native Watch app). */

export const MEETINGS_FOLDER = "CliffsCRM Meetings";

export type MeetingRecording = {
  id: string;
  createdAt: number;
  title: string;
  transcript: string;
  /** Filename only — audio stays in Files / Voice Memos on the phone */
  audioFileName?: string;
  audioFolderHint: string;
  durationSec?: number;
  companyId?: string;
  companyGuess?: string;
  captureId?: string;
  status: "inbox" | "filed" | "archived";
};

export function isWatchCaptureOpen(search: string): boolean {
  try {
    const q = search.startsWith("?") || search.startsWith("#") ? search : `?${search}`;
    const params = new URLSearchParams(q.startsWith("#") ? q.slice(1) : q);
    return params.get("open") === "watch-capture";
  } catch {
    return false;
  }
}

export function watchTextFromSearch(search: string): string {
  try {
    const q = search.startsWith("?") ? search : `?${search}`;
    const raw = new URLSearchParams(q).get("watch_text");
    return (raw || "").trim();
  } catch {
    return "";
  }
}

export function titleFromTranscript(transcript: string, max = 72): string {
  const line = transcript
    .trim()
    .split(/\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return "Untitled meeting";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1).trimEnd()}…`;
}

export function newMeetingId(): string {
  return `meet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newCaptureId(): string {
  return `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildMeetingRecording(input: {
  transcript: string;
  audioFileName?: string;
  audioFolderHint?: string;
  durationSec?: number;
  companyId?: string;
  companyGuess?: string;
  createdAt?: number;
}): MeetingRecording {
  const createdAt = input.createdAt ?? Date.now();
  const captureId = newCaptureId();
  return {
    id: newMeetingId(),
    createdAt,
    title: titleFromTranscript(input.transcript),
    transcript: input.transcript.trim(),
    audioFileName: input.audioFileName?.trim() || undefined,
    audioFolderHint: input.audioFolderHint?.trim() || MEETINGS_FOLDER,
    durationSec: input.durationSec,
    companyId: input.companyId,
    companyGuess: input.companyGuess,
    captureId,
    status: "inbox",
  };
}

export function captureFromMeeting(
  meeting: MeetingRecording,
): {
  id: string;
  createdAt: number;
  mode: "watch";
  text: string;
  companyId?: string;
  companyGuess?: string;
  status: "inbox";
} {
  const header = [
    `Watch meeting · ${meeting.title}`,
    meeting.audioFileName
      ? `Audio: ${meeting.audioFolderHint}/${meeting.audioFileName}`
      : `Audio folder: ${meeting.audioFolderHint}`,
  ].join("\n");
  return {
    id: meeting.captureId || newCaptureId(),
    createdAt: meeting.createdAt,
    mode: "watch",
    text: `${header}\n\n${meeting.transcript}`.trim(),
    companyId: meeting.companyId,
    companyGuess: meeting.companyGuess,
    status: "inbox",
  };
}

/** Steps shown in More → Watch meetings (and Shortcut recipe). */
export const WATCH_SHORTCUT_STEPS: string[] = [
  "On iPhone: Shortcuts → + → name it Cliff Meet",
  "Add Record Audio (stop when you tap; save as file)",
  "Add Save File → On My iPhone → CliffsCRM Meetings (create folder)",
  "Add Transcribe Audio (iOS 18+) on the recorded file",
  "Add Copy to Clipboard (the transcript)",
  "Add Open URLs → your CliffsCRM link with ?open=watch-capture",
  "Watch app → My Watch → Shortcuts → show Cliff Meet",
  "Add Shortcuts complication (or Dock) for one-tap start",
];

export function watchCaptureUrl(originBase: string): string {
  const root = originBase.replace(/\/+$/, "/");
  return `${root}?open=watch-capture`;
}
