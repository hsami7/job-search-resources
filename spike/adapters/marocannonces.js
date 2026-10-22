// MarocAnnonces adapter (spike). Public category listing; selectors verified
// 2026-10-22 against https://www.marocannonces.com/categorie/309/Emploi.html
// Card lines: title, city, snippet, "Niveau d'études souhaité: ...", "Salaire: ...", date, time
export const id = 'marocannonces';

export const listingUrl = ({ page = 1 } = {}) =>
  `https://www.marocannonces.com/categorie/309/Emploi/Offres-emploi/${page}.html`;

export async function collectFromListing(page) {
  return page.evaluate(() => {
    const clean = (s) => s?.replace(/\s+/g, ' ').trim() ?? null;
    return [...document.querySelectorAll('ul.cars-list > li')].map((li) => {
      const a = li.querySelector('a[href*="/annonce/"]') ?? li.querySelector('a[href]');
      const lines = li.innerText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const grab = (re) => lines.map((l) => re.exec(l)?.[1]).find(Boolean) ?? null;
      const idMatch = a?.href.match(/\/annonce\/(\d+)\//);
      return {
        source: 'marocannonces',
        mode: 'adapter',
        externalId: idMatch?.[1] ?? null,
        url: a?.href ?? null,
        title: clean(lines[0]),
        company: null, // classifieds rarely name the employer in the card
        location: clean(lines[1]),
        salary: grab(/^Salaire\s*:\s*(.+)$/i),
        studyLevel: grab(/^Niveau d'études souhaité\s*:\s*(.+)$/i),
        postedAtText: lines.slice(-2).join(' '),
        snippet: clean(lines[2]),
      };
    });
  });
}

export const selectors = { card: 'ul.cars-list > li', link: 'a[href*="/annonce/"]' };
