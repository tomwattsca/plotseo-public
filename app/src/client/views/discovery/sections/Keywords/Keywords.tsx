import KeywordItem from './KeywordItem';
import ReactPaginate from 'react-paginate';
import React, { useEffect, useState } from 'react';
import ClearButton from '../../components/ClearButton';
import { useRecoilState, useRecoilValue } from 'recoil';
import DropdownSort from '../../components/DropdownSort';
import DropdownShow from '../../components/DropdownShow';
import SerpCompare from '../../../../components/SerpCompare';
import { ISerpFeature } from '../../../../../types/ISerpFeature';
import { AtomDiscoveryControl, ControlHasFilters, IAtomDiscoveryControl } from '../../atoms/AtomDiscoveryControl';
import type { IDiscoveryItemOutput } from '../../../../../api/discovery/input/inputGetDiscoveryItems';

interface Props {
  reportId: string;
  compare: boolean;
  isLoading: boolean;
  ewPatterns: string[];
  clearFilters: () => void;
  items: IDiscoveryItemOutput[];
  setCompare: (compare: boolean) => void;
}

const PER_PAGE = 70;

const Keywords = ({ items, compare, reportId, isLoading, setCompare, ewPatterns, clearFilters }: Props) => {
  const [control, setControl] = useRecoilState(AtomDiscoveryControl);
  const hasFilters = useRecoilValue(ControlHasFilters);
  const [page, setPage] = useState(0);
  const [showSerp, setShowSerp] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentItems, setCurrentItems] = useState<IDiscoveryItemOutput[]>([]);

  useEffect(() => {
    const endOffset = control.itemOffset + PER_PAGE;
    setCurrentItems(items.slice(control.itemOffset, endOffset));
    setPageCount(Math.ceil(items.length / PER_PAGE));
    setPage(Math.floor(control.itemOffset / PER_PAGE));
  }, [control.itemOffset, items]);

  const hasSelected = control.selected.length > 0;
  const first = items.find((kw) => kw.keyword === control.selected[0]);
  const second = items.find((kw) => kw.keyword === control.selected[1]);
  const canCompare = control.selected.length === 2 && first?.urlsTop && second?.urlsTop;
  const filtersUsed = hasFilters ? getFiltersUsed(control, control.serpFeaturesFilter) : '';

  return (
    <div>
      {compare && canCompare ? <SerpCompare selected={[control.selected[0], control.selected[1]]} kw1={first} kw2={second} /> : undefined}
      <div className="bg-white rounded shadow">
        {currentItems.length > 0 && (
          <div className="border-0 border-b border-slate-200 select-none">
            <div className="pl-2 py-2 flex flex-wrap items-center">
              {hasSelected ? (
                <span className="flex items-center">
                  <i
                    className="ri-close-line ri-lg text-red-500 pl-1 pr-0.5 cursor-pointer"
                    onClick={() => {
                      setCompare(false);
                      setControl((prev) => ({ ...prev, selected: [] }));
                    }}
                  />
                </span>
              ) : (
                <input
                  type="checkbox"
                  className="focus:ring-sky-500 h-4 w-4 text-sky-500 border-slate-300 rounded"
                  onChange={(e) => {
                    setCompare(false);
                    if (e.target.checked) {
                      setControl((prev) => ({ ...prev, selected: items.map((kw) => kw.keyword) }));
                    } else {
                      setControl((prev) => ({ ...prev, selected: [] }));
                    }
                  }}
                />
              )}
              <div className="text-lg pl-3 text-slate-500 leading-none">Keywords</div>
              <div className="pl-2 leading-none text-sm">
                {control.selected.length > 0 && <span className="text-purple-600 pr-3">{control.selected.length} selected</span>}
                <span className="text-slate-500">{items.length} keywords</span>
              </div>
              {hasFilters ? (
                <div className="flex flex-wrap items-center justify-start lg:justify-end mt-2 lg:mt-0 md:pl-3">
                  <ClearButton label="Filters" onClear={clearFilters} />
                  {hasFilters && <div className="mt-2 lg:mt-0 md:ml-2 text-sm text-red-500">Filtering by {filtersUsed}</div>}
                </div>
              ) : undefined}
              <div className="flex-grow flex items-center justify-start lg:justify-end mt-2 2xl:mt-0">
                <div className="pr-3 flex flex-wrap items-center">
                  <DropdownSort
                    setSort={(s) => {
                      setControl((prev) => ({ ...prev, sort: s }));
                    }}
                    sort={control.sort}
                  />
                  <DropdownShow filters={control} setFilters={setControl} />
                </div>
              </div>
            </div>
          </div>
        )}
        {currentItems.map((kw) => {
          return (
            <KeywordItem
              keyword={kw}
              key={kw.keyword}
              reportId={reportId}
              isLoading={isLoading}
              ewPatterns={ewPatterns}
              ranking={control.ranking}
              highlight={control.search}
              competitors={kw.competitors}
              setRanking={(s) => {
                if (s === control.ranking) {
                  setControl((prev) => ({ ...prev, ranking: '', sort: 'ew' }));
                } else {
                  setControl((prev) => ({ ...prev, ranking: s, sort: 'ranking' }));
                }
              }}
              showEwScore={control.showEwScore}
              showClusters={control.showClusters}
              showEwMatches={control.showEwMatches}
              showTitleMatches={control.showTitleMatches}
              showSerpFeatures={control.showSerpFeatures}
              showCompetitors={control.showCompetitorDomains}
              showSemanticClusters={control.showSemanticClusters}
              open={showSerp === kw.keyword}
              selected={control.selected.includes(kw.keyword)}
              exactSearch={control.exactSearch || false}
              ewMatches={control.showEwMatches ? kw.ewMatches : undefined}
              clusters={control.showClusters ? kw.clusters : undefined}
              semanticClusters={control.showSemanticClusters ? kw.semanticClusters : undefined}
              serpFeaturesFilter={control.serpFeaturesFilter}
              onShowExtra={() => {
                if (showSerp === kw.keyword) {
                  setShowSerp('');
                } else {
                  setShowSerp(kw.keyword);
                }
              }}
              onSelectedChange={(e) => {
                setCompare(false);
                if (e.target.checked) {
                  setControl((prev) => ({ ...prev, selected: [...prev.selected, kw.keyword] }));
                } else {
                  setControl((prev) => ({ ...prev, selected: prev.selected.filter((s) => s !== kw.keyword) }));
                }
              }}
            />
          );
        })}
        {pageCount > 1 && (
          <ReactPaginate
            forcePage={page}
            breakLabel="..."
            nextLabel="next"
            previousLabel="prev"
            pageCount={pageCount}
            pageRangeDisplayed={5}
            renderOnZeroPageCount={undefined}
            breakClassName="text-gray-500 pr-2"
            nextLinkClassName="text-sm text-sky-700 pl-1"
            previousLinkClassName="mr-2 text-sm text-sky-700 pr-1"
            className="flex items-center justify-center p-3 select-none"
            activeLinkClassName="bg-sky-600 text-sky-50 hover:text-white hover:bg-sky-900 font-medium"
            pageLinkClassName="mr-2 px-2 py-0.5 text-sm bg-sky-100 hover:bg-sky-200 text-sky-900 rounded cursor-pointer select-none"
            onPageChange={(event) => {
              setControl((prev) => ({ ...prev, itemOffset: (event.selected * PER_PAGE) % items.length }));
            }}
          />
        )}
      </div>
    </div>
  );
};

const getFiltersUsed = (filters: IAtomDiscoveryControl, serpFeaturesFilter: ISerpFeature[]): string => {
  const filtersUsed: string[] = [];

  if (filters.search) {
    filtersUsed.push('search');
  }

  if (filters.domain.length > 0) {
    filtersUsed.push('domains');
  }

  if (filters.competitor.length > 0) {
    filtersUsed.push('competitors');
  }

  if (filters.cluster.length > 0) {
    filtersUsed.push('clusters');
  }

  if (filters.semanticCluster.length > 0) {
    filtersUsed.push('semantic clusters');
  }

  if (filters.minVol || filters.maxVol) {
    filtersUsed.push('volume');
  }

  if (filters.lemma.length > 0) {
    filtersUsed.push('verbs');
  }

  if (filters.ewPattern.length > 0) {
    filtersUsed.push('custom ew patterns');
  }

  if (filters.intent) {
    filtersUsed.push('intent');
  }

  if (filters.group) {
    filtersUsed.push('group');
  }

  if (filters.withoutSerpData) {
    filtersUsed.push('without serp data');
  }

  if (serpFeaturesFilter.length > 0) {
    filtersUsed.push('serp features');
  }

  return filtersUsed.join(', ');
};

export default Keywords;
