import React from 'react';
import Highlighter from 'react-highlight-words';
import { IDiscoverySerpItem } from '../../types/IDiscoverySerpItem';
import { FEATURED_SNIPPET, ISerpFeature, ORGANIC } from '../../types/ISerpFeature';

const MAX_URL_LENGTH = 75;

const Serp = ({
  search,
  keyword,
  ranking,
  patterns,
  setRanking,
  rankingPos,
  competitors,
  serpPositions,
}: {
  search?: string;
  keyword: string;
  ranking?: string;
  rankingPos?: number;
  patterns?: string[];
  competitors?: string[];
  setRanking: (ranking: string) => void;
  serpPositions: Array<IDiscoverySerpItem & { type: ISerpFeature }>;
}) => {
  return (
    <div>
      {serpPositions.map((pos, i) => {
        let found = rankingPos !== undefined && rankingPos === pos.position;
        if (search && pos.url?.includes(search)) {
          found = true;
        }

        const isCompetitor = competitors?.some((c) => pos.url?.includes(c));

        let cleanUrl = '';
        if (pos.url) {
          const url = pos.url;
          const U = new URL(url);
          const finalUrl = U.hostname + U.pathname;
          cleanUrl = finalUrl.replace(/\/$/, '');
        }

        return (
          <div
            key={`pos-${i}`}
            className={`flex flex-wrap items-center border-t border-slate-200 px-2 ${
              found ? 'bg-yellow-100 hover:bg-lime-100' : 'hover:bg-slate-50'
            }`}
          >
            <div>
              <div
                title="Check rankings for this URL"
                className={`px-2 py-1 mr-2 ${
                  ranking === cleanUrl
                    ? 'bg-sky-700 hover:text-sky-50 hover:bg-sky-600 text-white'
                    : 'bg-sky-100 hover:bg-sky-600 text-sky-400 hover:text-sky-50'
                } rounded cursor-pointer flex items-center`}
                onClick={() => {
                  if (cleanUrl) {
                    setRanking(cleanUrl);
                  }
                }}
              >
                <i className="ri-search-line" />
              </div>
            </div>
            <div className="flex-grow py-2">
              <div className={`text-sm ${isCompetitor ? 'text-red-700 underline font-medium' : 'text-gray-700'} flex items-center`}>
                {pos.type === FEATURED_SNIPPET ? (
                  <span className="text-xs text-yellow-500 mr-1 flex items-center">
                    <i className="ri-star-fill ri-lg" />
                  </span>
                ) : undefined}
                {pos.type === ORGANIC && <span className="font-semibold select-none mr-1">{pos.position}.</span>}{' '}
                <Highlighter
                  caseSensitive={false}
                  searchWords={[keyword]}
                  highlightClassName="bg-purple-100 text-purple-900 py-0 px-0"
                  textToHighlight={pos.title.replace(/[^a-zA-Z\d-:.']/g, ' ').replace(/\s+/g, ' ')}
                />
              </div>
              <div>
                <a
                  href={pos.url}
                  title={pos.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 text-[13px] inline-block select-none"
                >
                  <Highlighter
                    searchWords={patterns || []}
                    highlightClassName="bg-lime-200 text-slate-700 py-0 px-0"
                    textToHighlight={
                      pos.url !== undefined && pos.url.length >= MAX_URL_LENGTH ? `${pos.url.slice(0, MAX_URL_LENGTH)}...` : pos.url || ''
                    }
                  />
                </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Serp;
