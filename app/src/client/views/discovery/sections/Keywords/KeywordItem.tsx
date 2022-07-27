import { ISerpFeature } from '../../../../../types/ISerpFeature';
import React from 'react';
import { getWordBoundaryRegexString } from '../../../../../shared/regex';
import EasyWinScore from '../../../../components/EasyWinScore';
import Highlighter from 'react-highlight-words';
import { formatNumber } from '../../../../utils';
import KeywordContent from '../../../../components/KeywordContent';
import KeywordTag from './KeywordTag';
import type { IDiscoveryItemOutput } from '../../../../../api/discovery/input/inputGetDiscoveryItems';

interface ItemProps {
  open: boolean;
  ranking: string;
  reportId: string;
  isLoading: boolean;
  selected?: boolean;
  highlight?: string;
  clusters?: string[];
  exactSearch: boolean;
  showEwScore: boolean;
  ewMatches?: string[];
  ewPatterns?: string[];
  showClusters: boolean;
  competitors?: string[];
  showEwMatches: boolean;
  onShowExtra: () => void;
  showCompetitors: boolean;
  showSerpFeatures: boolean;
  showTitleMatches: boolean;
  semanticClusters?: string[];
  showSemanticClusters: boolean;
  keyword: IDiscoveryItemOutput;
  serpFeaturesFilter: ISerpFeature[];
  setRanking: (ranking: string) => void;
  onSelectedChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const KeywordItem = ({
  open,
  ranking,
  keyword,
  selected,
  clusters,
  highlight,
  ewMatches,
  setRanking,
  ewPatterns,
  competitors,
  exactSearch,
  onShowExtra,
  showEwScore,
  showClusters,
  showEwMatches,
  showCompetitors,
  semanticClusters,
  onSelectedChange,
  showTitleMatches,
  showSerpFeatures,
  serpFeaturesFilter,
  showSemanticClusters,
}: ItemProps) => {
  let searches: string[];
  if (highlight?.includes(',')) {
    searches = highlight
      .split(',')
      .filter((s) => !s.startsWith('-'))
      .map((s) => {
        if (exactSearch) {
          return getWordBoundaryRegexString(s.trim());
        }
        return s.trim();
      });
  } else {
    searches = highlight ? [exactSearch ? getWordBoundaryRegexString(highlight.trim()) : highlight.trim()] : [];
  }

  return (
    <div className={`border-0 border-b border-slate-200 py-2 ${selected ? 'bg-slate-50' : ''}`}>
      <div className="flex w-full">
        <div className={`flex items-center select-none pl-2`}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelectedChange}
            className="focus:ring-sky-500 h-4 w-4 text-sky-500 border-slate-300 rounded mr-1"
          />
          <div className={`w-[35px]`}>
            {keyword.urlsTop !== undefined ? (
              <div className="flex justify-center cursor-pointer font-semibold text-sm">
                <div
                  onClick={onShowExtra}
                  className={`px-1 ${
                    open ? 'bg-sky-800 text-sky-50 hover:bg-sky-600' : 'bg-sky-100 text-sky-800 hover:bg-lime-700 hover:text-lime-50'
                  } rounded select-none flex items-center`}
                >
                  <i className="ri-eye-line" />
                </div>
              </div>
            ) : (
              <div className="px-2 text-center text-gray-400 text-xs">&mdash;</div>
            )}
          </div>
          {showEwScore && (
            <div className={`flex items-center justify-center w-[30px]`}>
              {keyword.ewScore !== undefined ? (
                <EasyWinScore score={keyword.ewScore || 0} />
              ) : (
                <div className="text-gray-400 text-xs">&mdash;</div>
              )}
            </div>
          )}
          {ranking && (
            <div className="text-sm flex flex-grow items-center justify-end select-none tracking-widest w-[35px]">
              {keyword.rankingPosition !== undefined ? (
                <span className="text-lime-600 font-medium">#{keyword.rankingPosition}</span>
              ) : (
                <span className="text-slate-600">&mdash;</span>
              )}
            </div>
          )}
        </div>
        <div className="flex-grow">
          <div className={`flex flex-wrap w-full items-center pl-3`}>
            <div className="flex-grow truncate">
              <div title={keyword.keyword.length > 60 ? keyword.keyword : undefined} className="truncate flex items-center">
                <div className="flex-grow truncate text-[15px] text-slate-800">
                  {highlight ? (
                    <Highlighter textToHighlight={keyword.keyword} highlightClassName="px-0 bg-yellow-200" searchWords={searches} />
                  ) : (
                    <span>{keyword.keyword}</span>
                  )}
                </div>
                {keyword.isPaa ? <KeywordTag className="text-slate-700 bg-slate-50">PAA</KeywordTag> : undefined}
              </div>
            </div>
            <div className="flex justify-end select-none text-sm text-gray-500 pr-3">
              <span className="text-xs text-slate-800 flex items-center justify-end mr-3 w-[50px]" title="Volume">
                {keyword.volume === undefined ? <span>&mdash;</span> : formatNumber(keyword.volume)}
              </span>
              <span className="text-xs text-slate-600 flex items-center justify-end w-[50px]" title="CPC">
                {keyword.cpc === undefined || keyword.cpc === 0 ? (
                  <span>&mdash;</span>
                ) : (
                  `$${formatNumber(parseFloat(keyword.cpc.toString()))}`
                )}
              </span>
            </div>
            <div className="flex items-center justify-end mr-1 select-none ml-3 mr-2">
              <div className="text-sky-300 pr-2 cursor-pointer hidden md:block">
                <i
                  className="fa-brands fa-google"
                  onClick={() => {
                    if (keyword.googleUrl) {
                      window.open(keyword.googleUrl, '_blank');
                    } else {
                      window.open(`https://www.google.com/search?q=${keyword.keyword}`, '_blank');
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pl-[20px] pt-1.5 pr-[20px]">
        <div className="flex flex-wrap items-center">
          {showSerpFeatures && keyword.serpFeatures && keyword.serpFeatures.length > 0 && (
            <div className="flex flex-wrap items-center">
              {keyword.serpFeatures?.map((feature) => {
                const isFeatureFiltered = serpFeaturesFilter.includes(feature as ISerpFeature);
                return (
                  <KeywordTag
                    key={feature}
                    className={`${isFeatureFiltered ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'} mr-2`}
                  >
                    {feature.replace(/_/g, ' ')}
                  </KeywordTag>
                );
              })}
            </div>
          )}
          {showCompetitors && competitors && competitors.length > 0 && (
            <div className="flex items-center select-none text-slate-700 text-xs select-none leading-none pt-1">
              {competitors.map((competitor, i) => {
                const maxExceeded = competitor.length > 50;
                return (
                  <KeywordTag key={i} title={maxExceeded ? competitor : undefined} className="mr-3 text-red-800 bg-red-100">
                    {maxExceeded ? competitor.substring(0, 50) + '...' : competitor}
                  </KeywordTag>
                );
              })}
            </div>
          )}
          {showEwMatches && ewMatches && ewMatches.length > 0 && (
            <div className="flex items-center select-none text-slate-700 text-xs select-none leading-none pt-1">
              {ewMatches.map((domain, i) => (
                <KeywordTag key={i} className="mr-3 text-lime-800 bg-lime-100">
                  {domain}
                </KeywordTag>
              ))}
            </div>
          )}
          {showClusters && clusters && clusters.length > 0 && (
            <div className="flex items-center select-none text-slate-700 text-xs select-none leading-none pt-1">
              {clusters.map((cluster, i) => {
                const maxExceeded = cluster.length > 50;
                return (
                  <KeywordTag key={i} title={maxExceeded ? cluster : undefined} className="mr-3 text-sky-800 bg-sky-100">
                    {maxExceeded ? cluster.substring(0, 50) + '...' : cluster}
                  </KeywordTag>
                );
              })}
            </div>
          )}
          {showSemanticClusters && semanticClusters && semanticClusters.length > 0 && (
            <div className="flex items-center select-none text-slate-700 text-xs select-none leading-none pt-1">
              {semanticClusters.map((semanticCluster, i) => {
                const maxExceeded = semanticCluster.length > 50;
                return (
                  <KeywordTag key={i} title={maxExceeded ? semanticCluster : undefined} className="mr-3 text-cyan-800 bg-cyan-100">
                    {maxExceeded ? semanticCluster.substring(0, 50) + '...' : semanticCluster}
                  </KeywordTag>
                );
              })}
            </div>
          )}
          {showTitleMatches && (keyword.titlePartialMatch || keyword.titleExactMatch) && (
            <div className="flex items-center select-none text-teal-700 text-xs select-none leading-none pt-1">
              {keyword.titleExactMatch === true && <KeywordTag className="mr-3 bg-teal-50">exact match</KeywordTag>}
              {keyword.titlePartialMatch === true && <KeywordTag className="mr-3 bg-teal-50">partial match</KeywordTag>}
            </div>
          )}
        </div>
        {open && keyword.urlsTop !== undefined && (
          <div className="w-full">
            <KeywordContent
              ranking={ranking}
              keyword={keyword}
              setRanking={setRanking}
              ewPatterns={ewPatterns}
              competitors={competitors}
              rankingPos={keyword.rankingPosition}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default KeywordItem;
