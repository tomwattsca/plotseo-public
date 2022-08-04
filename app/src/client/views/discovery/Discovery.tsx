import 'antd/dist/antd.css';
import { flatten } from 'lodash';
import Bar from './components/Bar';
import Nav from '../../components/Nav';
import React, { useState } from 'react';
import useDiscovery from './useDiscovery';
import Tailwind from '../../components/Tailwind';
import ClearButton from './components/ClearButton';
import Keywords from './sections/Keywords/Keywords';
import SerpDataModal from './components/SerpDataModal';
import DiscoveryTitle from './components/DiscoveryTitle';
import DropdownSections from './components/DropdownSections';
import ShowCurrentSection from './sections/ShowCurrentSection';
import RemoveKeywordsModal from './components/RemoveKeywordsModal';
import { DISCOVERY_KEYWORDS_LIMIT } from '../../../constants';
import { REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING, REPORT_STATUS_QUEUED } from '../../../types/IReportStatus';

const Processing = () => {
  return (
    <div className="bg-slate-500 text-white py-2 px-4 rounded text-sm select-none">
      <i className="ri-refresh-line mr-2 text-orange-300" />
      We are getting and analyzing your data, please wait.
      <br />
      Depending on the amount of keywords, this might take from a few minutes to half an hour.
      <br />
      Clusters will be re-calculated based on new data.
    </div>
  );
};

const Error = () => {
  return (
    <div className="bg-slate-700 text-white py-2 px-4 rounded text-lg select-none">
      <i className="ri-close-line mr-2 text-red-400" />
      There was an error generating the report.
    </div>
  );
};

const Discovery = () => {
  const {
    base,
    pills,
    terms,
    items,
    verbs,
    domains,
    clusters,
    isLoading,
    hasFilters,
    ewPatterns,
    competitors,
    allEwPatterns,
    filteredItems,
    hasRunningTasks,
    semanticClusters,
    reportNotFinished,
    download,
    clearFilters,
    doGetSerps,
    doAddGroup,
    doRemoveGroup,
    doExpandKeywords,
    doRemoveKeywords,
    doUpdateEwPatterns,
    doUpdateCompetitors,
    doUpdateGroupKeywords,
  } = useDiscovery();

  const [compare, setCompare] = useState(false);
  const [showConfirmRemoveKwsModal, setShowConfirmRemoveKwsModal] = useState(false);
  const [showConfirmSerpModal, setShowConfirmSerpModal] = useState<'full' | 'selected' | ''>('');

  if (!base) {
    return (
      <div>
        <Nav />
        <div className="p-6 container mx-auto mb-5 select-none">
          <div className="px-3 py-2 bg-slate-700 text-white rounded">Loading...</div>
        </div>
      </div>
    );
  }

  if (base.status === REPORT_STATUS_PROCESSING || base.status === REPORT_STATUS_QUEUED || base.status === REPORT_STATUS_ERROR) {
    return (
      <div>
        <Nav />
        <div className="p-6 container mx-auto mb-5">
          <Tailwind />
          {base.status !== REPORT_STATUS_ERROR && <Processing />}
          {base.status === REPORT_STATUS_ERROR && <Error />}
        </div>
      </div>
    );
  }

  const serpsFull = showConfirmSerpModal === 'full';
  const showLoadingSpinner = hasRunningTasks || isLoading;
  const hasReachedLimit = items.length >= DISCOVERY_KEYWORDS_LIMIT;
  const withoutSerpData = items.filter((item) => item.urlsTop === undefined);
  const allPaa = flatten(items.map((item) => item.paa || [])).filter((paa) => paa !== undefined);

  return (
    <div>
      <Tailwind />
      <SerpDataModal
        serpsFull={serpsFull}
        doGetSerps={doGetSerps}
        showConfirmSerpModal={showConfirmSerpModal}
        setShowConfirmSerpModal={setShowConfirmSerpModal}
      />
      <RemoveKeywordsModal show={showConfirmRemoveKwsModal} doRemoveKeywords={doRemoveKeywords} setShow={setShowConfirmRemoveKwsModal} />
      <Nav />
      <div className="pl-6 pr-6 pb-10 pt-3">
        <div>
          <DiscoveryTitle name={base.name} loading={showLoadingSpinner} />
        </div>
        <div className="flex flex-wrap">
          <div className="w-full xl:w-3/12">
            <div className="xl:mr-3">
              {!isLoading && withoutSerpData.length === items.length && (
                <div className="mb-3 px-3 py-2 bg-red-50 text-red-700 font-medium shadow rounded select-none">
                  Get SERP data for automatic clustering, ideas, etc.
                </div>
              )}
              <div className="mb-3 w-full">
                <DropdownSections />
              </div>
              <ShowCurrentSection
                items={items}
                pills={pills}
                verbs={verbs}
                terms={terms}
                allPaa={allPaa}
                domains={domains}
                reportId={base._id}
                clusters={clusters}
                groups={base.groups}
                isLoading={isLoading}
                reportSeed={base.seed}
                ewPatterns={ewPatterns}
                doAddGroup={doAddGroup}
                competitors={competitors}
                filteredItems={filteredItems}
                doRemoveGroup={doRemoveGroup}
                hasRunningTasks={hasRunningTasks}
                semanticClusters={semanticClusters}
                doExpandKeywords={doExpandKeywords}
                reportNotFinished={reportNotFinished}
                doUpdateEwPatterns={doUpdateEwPatterns}
                hasTopicMap={base.hasTopicMap || false}
                doUpdateCompetitors={doUpdateCompetitors}
                ewDefaults={base.easyWinsDefaults || false}
                doUpdateGroupKeywords={doUpdateGroupKeywords}
                competitorPatterns={base.competitorPatterns || []}
              />
            </div>
          </div>
          <div className="w-full xl:w-9/12">
            <Bar
              items={items}
              compare={compare}
              download={download}
              isLoading={isLoading}
              setCompare={setCompare}
              hasReachedLimit={hasReachedLimit}
              hasRunningTasks={hasRunningTasks}
              setShowConfirmSerpModal={setShowConfirmSerpModal}
              setShowConfirmRemoveKwsModal={setShowConfirmRemoveKwsModal}
              canDownloadFiltered={filteredItems.length > 0 && filteredItems.length !== items.length}
            />
            {hasRunningTasks && (
              <div className="mb-3">
                <Processing />
              </div>
            )}
            {isLoading && (
              <div className="bg-white rounded shadow overflow-hidden text-center py-2">
                <i className="ri-refresh-line" />
              </div>
            )}
            {!isLoading && hasReachedLimit && (
              <div className="w-full px-3 py-2 rounded bg-slate-600 text-white select-none mb-3">
                You have reached the limit of {DISCOVERY_KEYWORDS_LIMIT} keywords per report
              </div>
            )}
            {!isLoading && filteredItems && filteredItems.length > 0 ? (
              <Keywords
                compare={compare}
                reportId={base?._id}
                items={filteredItems}
                setCompare={setCompare}
                ewPatterns={allEwPatterns}
                clearFilters={clearFilters}
                isLoading={isLoading || hasRunningTasks}
              />
            ) : undefined}
            {!isLoading && filteredItems && filteredItems.length === 0 ? (
              <div>
                {hasFilters && (
                  <div className="mb-3">
                    <ClearButton label="Filters" onClear={clearFilters} />
                  </div>
                )}
                <div className="w-full px-3 py-2 rounded bg-slate-600 text-white select-none">
                  <div>No keywords found.</div>
                </div>
              </div>
            ) : undefined}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discovery;
