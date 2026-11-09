// Daily digest: the three numbers worth opening the app for. Pure computation
// over rows the caller already fetched; no I/O, no clock reads beyond `now`.
export function buildDigest({ jobs = [], submissions = [], now = new Date() } = {}) {
  const today = startOfDay(now);
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000);
  const weekAhead = new Date(today.getTime() + 7 * 86_400_000);

  const newSince = jobs.filter((job) => job.state === 'new' && stamp(job) >= weekAgo).length;

  const closingSoon = jobs
    .filter((job) => job.state !== 'dismissed' && job.state !== 'archived')
    .map((job) => ({ id: job.id, title: job.title, company: job.company, deadline: job.deadline }))
    .filter((job) => {
      if (!job.deadline) return false;
      const at = dayValue(job.deadline);
      return Number.isFinite(at) && at >= today.getTime() && at <= weekAhead.getTime();
    })
    .sort((a, b) => dayValue(a.deadline) - dayValue(b.deadline));

  const followUpsDue = submissions
    .filter((sub) => {
      if (sub.status !== 'sent' && sub.status !== 'replied') return false;
      if (!sub.followUpAt) return false;
      const at = new Date(sub.followUpAt);
      return Number.isFinite(at.getTime()) && at <= now;
    })
    .map((sub) => ({ id: sub.id, jobTitle: sub.jobTitle, jobCompany: sub.jobCompany, followUpAt: sub.followUpAt }));

  const counts = {
    newSince,
    closingSoon: closingSoon.length,
    followUpsDue: followUpsDue.length,
  };

  return { newSince, closingSoon, followUpsDue, counts };
}

export function digestLine(digest) {
  const parts = [];
  if (digest.counts.newSince) parts.push(`${digest.counts.newSince} new`);
  if (digest.counts.closingSoon) parts.push(`${digest.counts.closingSoon} closing this week`);
  if (digest.counts.followUpsDue) parts.push(`${digest.counts.followUpsDue} follow-up due`);
  return parts.join(' · ');
}

function stamp(job) {
  const raw = job.firstSeenAt ?? job.createdAt ?? null;
  const at = raw ? new Date(raw) : NaN;
  return Number.isFinite(at.getTime()) ? at : new Date(0);
}

// A deadline is a calendar day, not an instant. `new Date('2026-11-15')` is UTC
// midnight, which lands on the wrong local day anywhere west of Greenwich.
function dayValue(raw) {
  const text = String(raw ?? '');
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const at = new Date(text);
  return Number.isFinite(at.getTime()) ? at.getTime() : NaN;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
