/**
 * Unit tests for cardDetector (jsdom + 匿名化フィクスチャ)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  COMPANY_NAME_SELECTOR,
  PAGE_CARD_CONTAINERS,
  USER_LINK_SELECTOR,
  extractCompanyName,
  findCandidateCards,
  isCompanyFiltered,
  resolveCardContainerSelector,
  shouldWarnNoCardsDetected
} from '../cardDetector';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function loadFixture(name: string): void {
  document.body.innerHTML = fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
}

function cardsOf(pathname: string, fixture: string): Element[] {
  loadFixture(fixture);
  const selector = resolveCardContainerSelector(pathname);
  expect(selector).not.toBeNull();
  return findCandidateCards(document, selector as string);
}

function companyNames(cards: Element[]): string[] {
  return cards.map(card => extractCompanyName(card));
}

describe('resolveCardContainerSelector', () => {
  it('resolves /friend_connections', () => {
    expect(resolveCardContainerSelector('/friend_connections'))
      .toBe(PAGE_CARD_CONTAINERS['/friend_connections']);
  });

  it('resolves /friend_candidates', () => {
    expect(resolveCardContainerSelector('/friend_candidates'))
      .toBe(PAGE_CARD_CONTAINERS['/friend_candidates']);
  });

  it('resolves /friend_connections/ with a trailing slash', () => {
    const selector = resolveCardContainerSelector('/friend_connections/');
    expect(selector).not.toBeNull();
    expect(selector).toBe(PAGE_CARD_CONTAINERS['/friend_connections']);
  });

  it('resolves /friend_candidates/ with a trailing slash', () => {
    const selector = resolveCardContainerSelector('/friend_candidates/');
    expect(selector).not.toBeNull();
    expect(selector).toBe(PAGE_CARD_CONTAINERS['/friend_candidates']);
  });

  it('matches by prefix so manifest "*" sub-paths still resolve', () => {
    expect(resolveCardContainerSelector('/friend_connections/recommended'))
      .toBe(PAGE_CARD_CONTAINERS['/friend_connections']);
  });

  it('returns null for unrelated, empty and root pathnames', () => {
    expect(resolveCardContainerSelector('/home')).toBeNull();
    expect(resolveCardContainerSelector('/')).toBeNull();
    expect(resolveCardContainerSelector('')).toBeNull();
  });
});

describe('findCandidateCards on /friend_connections', () => {
  const containerSelector = PAGE_CARD_CONTAINERS['/friend_connections'];

  it('detects only containers that hold a /users/ link', () => {
    loadFixture('friendConnections.html');
    const allContainers = document.querySelectorAll(containerSelector);
    const cards = findCandidateCards(document, containerSelector);

    // 「一覧で見る」カードは /users/ リンクを持たないので除外される
    expect(allContainers.length).toBe(5);
    expect(cards.length).toBe(4);
  });

  it('returns one entry per card even though each card has two /users/ links', () => {
    loadFixture('friendConnections.html');
    const cards = findCandidateCards(document, containerSelector);
    const links = document.querySelectorAll(USER_LINK_SELECTOR);

    // アバター + 氏名の2本 x 4枚 + ヘッダーの1本
    expect(links.length).toBe(9);
    expect(cards.length).toBe(4);
    expect(new Set(cards).size).toBe(cards.length);
  });

  it('excludes the stray header /users/ link that sits outside every card', () => {
    loadFixture('friendConnections.html');
    const cards = findCandidateCards(document, containerSelector);
    const headerLink = document.querySelector('header a[href="/users/fixture-user-self"]');

    expect(headerLink).not.toBeNull();
    expect(cards.some(card => card.contains(headerLink as Element))).toBe(false);
  });

  it('returns an empty array for an empty container selector', () => {
    loadFixture('friendConnections.html');
    expect(findCandidateCards(document, '')).toEqual([]);
  });

  it('scopes the search to the given root', () => {
    loadFixture('friendConnections.html');
    const carousel = document.querySelector('.carousel') as ParentNode;
    expect(findCandidateCards(carousel, containerSelector).length).toBe(4);

    const header = document.querySelector('header') as ParentNode;
    expect(findCandidateCards(header, containerSelector).length).toBe(0);
  });
});

describe('extractCompanyName on /friend_connections', () => {
  it('reads the first caption as the company name', () => {
    const cards = cardsOf('/friend_connections', 'friendConnections.html');
    expect(companyNames(cards)).toEqual([
      'Example株式会社',
      'Example株式会社/ExampleTwo株式会社/ExampleThree株式会社',
      'フリーランス',
      ''
    ]);
  });

  it('accepts an explicit caption selector', () => {
    const cards = cardsOf('/friend_connections', 'friendConnections.html');
    expect(extractCompanyName(cards[0], COMPANY_NAME_SELECTOR)).toBe('Example株式会社');
    expect(extractCompanyName(cards[0], '.does-not-exist')).toBe('');
  });

  it('returns an empty string when the caption is missing', () => {
    loadFixture('friendConnections.html');
    const cardWithoutCaption = document
      .querySelector('a[href="/users/fixture-user-14"]')
      ?.closest(PAGE_CARD_CONTAINERS['/friend_connections']) as Element;

    expect(cardWithoutCaption.querySelector(COMPANY_NAME_SELECTOR)).toBeNull();
    expect(extractCompanyName(cardWithoutCaption)).toBe('');
  });
});

describe('isCompanyFiltered', () => {
  it('matches a normal single-company caption', () => {
    expect(isCompanyFiltered('Example株式会社', ['Example株式会社'])).toBe(true);
  });

  it('matches every company inside a slash-joined caption', () => {
    const caption = 'Example株式会社/ExampleTwo株式会社/ExampleThree株式会社';
    expect(isCompanyFiltered(caption, ['ExampleTwo株式会社'])).toBe(true);
    expect(isCompanyFiltered(caption, ['ExampleThree株式会社'])).toBe(true);
  });

  it('matches フリーランス when it is registered as a filter term', () => {
    expect(isCompanyFiltered('フリーランス', ['フリーランス'])).toBe(true);
    expect(isCompanyFiltered('フリーランス', ['Example株式会社'])).toBe(false);
  });

  it('never matches an empty caption or an empty filter list', () => {
    expect(isCompanyFiltered('', ['Example株式会社'])).toBe(false);
    expect(isCompanyFiltered('Example株式会社', [])).toBe(false);
  });

  it('ignores empty filter entries instead of matching everything', () => {
    expect(isCompanyFiltered('Example株式会社', [''])).toBe(false);
  });

  it('pins the current substring, case-sensitive behavior', () => {
    // 部分一致：登録語がキャプションの一部でも一致する
    expect(isCompanyFiltered('Example株式会社', ['Example'])).toBe(true);
    // 大文字小文字は区別する（この挙動は本Issueでは変更しない）
    expect(isCompanyFiltered('Example株式会社', ['example'])).toBe(false);
  });
});

describe('/friend_candidates regression pin', () => {
  const containerSelector = PAGE_CARD_CONTAINERS['/friend_candidates'];

  it('still detects grid cards by the same structural rule', () => {
    const cards = cardsOf('/friend_candidates', 'friendCandidates.html');
    expect(document.querySelectorAll(containerSelector).length).toBe(5);
    expect(cards.length).toBe(4);
  });

  it('still reads the same company names', () => {
    const cards = cardsOf('/friend_candidates', 'friendCandidates.html');
    expect(companyNames(cards)).toEqual([
      'Example株式会社',
      'Example株式会社/ExampleTwo株式会社/ExampleThree株式会社',
      'フリーランス',
      ''
    ]);
  });

  it('dims exactly the cards whose caption contains a filtered company', () => {
    const cards = cardsOf('/friend_candidates', 'friendCandidates.html');
    const filtered = cards.filter(card =>
      isCompanyFiltered(extractCompanyName(card), ['ExampleThree株式会社'])
    );

    expect(filtered.length).toBe(1);
    expect(extractCompanyName(filtered[0]))
      .toBe('Example株式会社/ExampleTwo株式会社/ExampleThree株式会社');
  });
});

describe('shouldWarnNoCardsDetected', () => {
  it('warns when user links exist but no card is recognized repeatedly', () => {
    expect(shouldWarnNoCardsDetected(20, 0, 3)).toBe(true);
  });

  it('does not warn while cards are still recognized', () => {
    expect(shouldWarnNoCardsDetected(20, 4, 5)).toBe(false);
  });

  it('does not warn when only the header avatar link is present', () => {
    expect(shouldWarnNoCardsDetected(1, 0, 5)).toBe(false);
    expect(shouldWarnNoCardsDetected(0, 0, 5)).toBe(false);
  });

  it('does not warn before the consecutive zero-scan threshold is reached', () => {
    expect(shouldWarnNoCardsDetected(20, 0, 2)).toBe(false);
  });
});
