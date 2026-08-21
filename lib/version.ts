export const APP_VERSION_LABEL = "step3.4 — версійний маркер в UI";

export function getBuildMarker(): string {
  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const shortSha = sha ? sha.slice(0, 7) : null;
  return shortSha ? `${APP_VERSION_LABEL} · ${shortSha}` : APP_VERSION_LABEL;
}
