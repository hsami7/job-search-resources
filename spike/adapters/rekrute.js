// ReKrute adapter (spike). Public listing works without login; selectors verified
// 2026-10-22 against https://www.rekrute.com/offres-emploi-maroc.html
export const id = 'rekrute';

export const listingUrl = ({ page = 1 } = {}) =>
  page === 1
    ? 'https://www.rekrute.com/offres-emploi-maroc.html'
    : `https://www.rekrute.com/offres-emploi-maroc.html?page=${page}`;

// Card anchors carry the meaning:
//   a.titreJob                          -> job detail, text "Title | City (Country)"
//   first unnamed anchor                -> employer page
//   a[href*=contractType]               -> CDI/CDD/...
//   a[href*=workExperienceId|studyLevelId|sectorId]
export async function collectFromListing(page) {
  return page.evaluate(() => {
    const text = (el, sel) => el.querySelector(sel)?.innerText?.replace(/\s+/g, ' ').trim() ?? null;
    return [...document.querySelectorAll('.post-id')].map((card) => {
      const jobLink = card.querySelector('a.titreJob');
      const heading = jobLink?.innerText?.replace(/\s+/g, ' ').trim() ?? '';
      const [title, place] = heading.split('|').map((s) => s.trim());
      const employerLink = [...card.querySelectorAll('a[href]')].find((a) =>
        /emploi-recrutement-\d+\.html/.test(a.href),
      );
      const body = card.innerText.replace(/\s+/g, ' ').trim();
      return {
        source: 'rekrute',
        mode: 'adapter',
        externalId: jobLink?.href.match(/-(\d+)\.html/)?.[1] ?? null,
        url: jobLink?.href.split('?')[0] ?? null,
        title: title || null,
        company:
          employerLink?.href
            .match(/\/([^/]+)-emploi-recrutement-/)?.[1]
            ?.replace(/-/g, ' ') ?? null,
        location: place ?? null,
        employmentType: text(card, 'a[href*="contractType"]'),
        experience: text(card, 'a[href*="workExperienceId"]'),
        studyLevel: text(card, 'a[href*="studyLevelId"]'),
        sector: text(card, 'a[href*="sectorId"]'),
        remote: /Télétravail\s*:\s*Oui/i.test(body) ? true : /Télétravail\s*:\s*Non/i.test(body) ? false : null,
        postedAt: body.match(/Publication\s*:\s*du\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null,
        snippet: card.querySelector('p, .desc')?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 400) ?? null,
      };
    });
  });
}

export const selectors = { card: '.post-id', jobLink: 'a.titreJob' };
