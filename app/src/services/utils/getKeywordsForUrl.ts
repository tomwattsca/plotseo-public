import URLParse from 'url-parse';
import { getD4SRankedKeywords } from '../../shared/d4s';

export const getKeywordsForUrl = async (_url: string, language: string, location: string, searchEngine: string) => {
  const url = URLParse(_url);

  let pathname: string | undefined;
  if (_url.endsWith('/') && url.pathname === '/') {
    pathname = url.pathname;
  } else if (!_url.endsWith('/') && url.pathname === '/') {
    pathname = undefined;
  } else {
    pathname = url.pathname;
  }

  if (!process.env.D4S_API_USER || !process.env.D4S_API_PASS) {
    console.error(`[getKeywordsForUrl]: No D4S credentials provided`);
    return undefined;
  }

  const newKeywords = await getD4SRankedKeywords(
    process.env.D4S_API_USER,
    process.env.D4S_API_PASS,
    url.hostname,
    pathname,
    location,
    searchEngine,
    language,
  );

  if (newKeywords && newKeywords.length > 0) {
    return newKeywords;
  }

  return undefined;
};
