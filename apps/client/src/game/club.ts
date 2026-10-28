/**
 * The club, from the client's side.
 *
 * Every action answers with the whole club as it now stands, so there is
 * never a second round trip and never a moment where the popup is showing
 * one thing and the server believes another. The server is the authority on
 * every rule in here; this file only asks.
 *
 * `null` means "you are not in a club", which is not an error — it is what
 * the founding screen is drawn from.
 */
import { db, SERVER_HTTP } from "./account";

export interface ClubMember {
  id: string;
  nickname: string;
  avatar: string;
  trophies: number;
  online: boolean;
  owner: boolean;
}

export interface ClubMessage {
  id: number;
  playerId: string;
  nickname: string;
  avatar: string;
  body: string;
  at: string;
}

export interface ClubRequest {
  id: number;
  playerId: string;
  nickname: string;
  cardId: string;
  filled: number;
  of: number;
  mine: boolean;
  gave: boolean;
}

export interface ClubChallengeView {
  id: string;
  period: "daily" | "weekly" | "monthly";
  kind: "trophies" | "cards" | "wins" | "battles";
  target: number;
  chest: "wood" | "silver" | "gold";
  amount: number;
  contributed: number;
  done: boolean;
  claimed: boolean;
}

export interface Club {
  id: string;
  name: string;
  emblem: string;
  owner: boolean;
  members: ClubMember[];
  /** Who typed a live code and is waiting for the owner to say yes. */
  waiting: ClubMember[];
  messages: ClubMessage[];
  requests: ClubRequest[];
  challenges: ClubChallengeView[];
  emblems: string[];
}

export interface ClubAnswer {
  club: Club | null;
  /**
   * The club you are QUEUING at, when you are in none.
   *
   * Or: *"the manager will also have to approve their entry."* So between
   * typing the six digits and being in a club there is a third state, and
   * the popup has to be able to draw it: a name, a picture, and a way out.
   */
  waiting?: { name: string; emblem: string };
  /** Six digits worth thirty seconds, for whoever pressed +. */
  invite?: { code: string; until: string };
  error?: string;
  /**
   * The only thing in this whole feature a child is made to read.
   *
   * Or: *"do not write all these explanations to the user. The user sees
   * only buttons. Give messages only for critical things (your message was
   * deleted because of improper words. This is a warning, but next time will
   * remove you from the club immediately)."*
   */
  notice?: "club.warned" | "club.removed";
}

async function ask(path: string, body?: Record<string, unknown>): Promise<ClubAnswer> {
  if (!SERVER_HTTP) return { club: null };
  try {
    const sb = db();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    const res = await fetch(`${SERVER_HTTP}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json()) as ClubAnswer;
    return data ?? { club: null };
  } catch {
    return { club: null, error: "club.retry" };
  }
}

export const loadClub = () => ask("/api/club");
export const createClub = (name: string, emblem?: string) =>
  ask("/api/club/create", { name, ...(emblem ? { emblem } : {}) });
export const inviteToClub = () => ask("/api/club/invite");
export const answerAtDoor = (playerId: string, yes: boolean) =>
  ask("/api/club/door", { playerId, yes });
export const joinClub = (code: string) => ask("/api/club/join", { code });
export const leaveClub = () => ask("/api/club/leave");
export const closeClub = () => ask("/api/club/close");
export const dressClub = (patch: { name?: string; emblem?: string }) =>
  ask("/api/club/dress", patch);
export const bequeathClub = (playerId: string) => ask("/api/club/bequeath", { playerId });
export const sayInClub = (body: string) => ask("/api/club/say", { body });
export const askForCard = (cardId: string) => ask("/api/club/ask", { cardId });
export const donateCard = (requestId: number) => ask("/api/club/donate", { requestId });
export const claimClubChest = (challengeId: string) => ask("/api/club/claim", { challengeId });
export const reportClubMember = (playerId: string, message: string) =>
  ask("/api/club/report", { playerId, message });

/**
 * Is there anything in there I have not seen?
 *
 * Or: *"if there is a message or a challenge or something new in the club —
 * there is a green dot next to it on the home screen."* One small question,
 * asked where the home screen draws, and answered false for anybody without
 * a club.
 */
export async function clubHasNews(): Promise<boolean> {
  if (!SERVER_HTTP) return false;
  try {
    const sb = db();
    const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
    if (!token) return false;
    const res = await fetch(`${SERVER_HTTP}/api/club/news`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    });
    const data = (await res.json()) as { news?: boolean };
    return !!data?.news;
  } catch {
    return false;
  }
}
