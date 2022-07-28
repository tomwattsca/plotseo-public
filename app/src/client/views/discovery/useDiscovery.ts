import { trpc } from '../../utils';
import { flatten, sortBy, uniq } from 'lodash';
import writeXlsxFile, { Row } from 'write-excel-file';
import { cleanKeyword } from '../../../shared/keyword';
import { useCallback, useEffect, useMemo } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { IReportTask } from '../../../types/IReportTask';
import { getWordBoundaryRegex } from '../../../shared/regex';
import { IDiscoveryTerm, IDiscoveryTermChild } from '../../../types/IDiscoveryTerm';
import { AtomDiscoveryControl, ControlHasFilters } from './atoms/AtomDiscoveryControl';
import { REPORT_STATUS_COMPLETED, REPORT_STATUS_ERROR, REPORT_STATUS_PROCESSING, REPORT_STATUS_QUEUED } from '../../../types/IReportStatus';
import { SEARCH_TYPE_CUSTOM, SEARCH_TYPE_QUESTIONS, SEARCH_TYPE_URL, SEARCH_TYPE_WILDCARD } from '../../../types/IDiscoverySearchType';

interface customWindow extends Window {
  __id: string;
}
declare const window: customWindow;

const useDiscovery = () => {
  const [control, setControl] = useRecoilState(AtomDiscoveryControl);
  const hasFilters = useRecoilValue(ControlHasFilters);

  const clearFilters = () => {
    setControl((prev) => ({
      ...prev,
      minVol: undefined,
      maxVol: undefined,
      lemma: [],
      group: '',
      search: '',
      domain: [],
      ignore: '',
      intent: '',
      ranking: '',
      cluster: [],
      selected: [],
      ewPattern: [],
      competitor: [],
      semanticCluster: [],
      withoutSerpData: false,
      serpFeaturesFilter: [],
    }));
  };

  const doGetBase = trpc.useQuery(['discovery:base', { reportId: window.__id }], {
    onSuccess: (data) => {
      if (data.success && data.id && data.report) {
        if (data.report.status !== REPORT_STATUS_COMPLETED && data.report.status !== REPORT_STATUS_ERROR) {
          setTimeout(async () => {
            await doGetBase.refetch();
          }, 5_000);
        }
      }
    },
    refetchOnWindowFocus: false,
  });

  const doGetItems = trpc.useQuery(['discovery:items', { reportId: window.__id }], {
    enabled: doGetBase.data !== undefined && doGetBase.data.id !== undefined,
  });

  const doGetClusters = trpc.useQuery(['discovery:clusters', { reportId: window.__id }], { refetchOnWindowFocus: false });

  const base = useMemo(() => doGetBase.data?.report, [doGetBase.data?.report]);
  const clusters = useMemo(() => doGetClusters.data?.clusters || [], [doGetClusters.data?.clusters]);
  const semanticClusters = useMemo(() => doGetClusters.data?.semanticClusters || {}, [doGetClusters.data?.semanticClusters]);
  const items = useMemo(() => {
    const currentItems = doGetItems.data?.items;
    if (currentItems) {
      return currentItems.map((item) => {
        let rankingPosition: number | undefined;
        if (control.ranking) {
          const reg = getWordBoundaryRegex(control.ranking);

          if (item.urlsAll) {
            const found = item.urlsAll.find((url) => reg.test(url.url));
            if (found) {
              rankingPosition = found.position;
            }
          }

          if (item.featuredSnippet && item.featuredSnippet.url && reg.test(item.featuredSnippet.url)) {
            rankingPosition = 0;
          }
        }

        return {
          ...item,
          rankingPosition,
        };
      });
    }

    return [];
  }, [doGetItems.data?.items, control.ranking]);

  const filteredItems = useMemo(() => {
    if (!base) {
      return [];
    }

    let finalItems = items;

    if (control.group && base.groups) {
      const group = base.groups.find((g) => g.name === control.group);
      if (group) {
        finalItems = finalItems.filter((kw) => group.keywords.includes(kw.keyword));
      }
    }

    if (control.intent) {
      finalItems = finalItems.filter((kw) => kw.intent && kw.intent.includes(control.intent));
    }

    if (control.ignore) {
      const ignored = control.ignore.split(',').map((s) => s.trim());
      finalItems = finalItems.filter((kw) => ignored.filter((k) => kw.keyword.includes(k)).length === 0);
    }

    if (control.withoutSerpData) {
      finalItems = finalItems.filter((kw) => kw.urlsTop === undefined);
    }

    if (control.lemma.length > 0) {
      const newItems = finalItems.filter((kw) => control.lemma.some((lemma) => kw.lemmas?.includes(lemma)));
      if (newItems.length === 0) {
        finalItems = finalItems.filter((kw) => control.lemma.some((lemma) => kw.keyword.includes(lemma)));
      } else {
        finalItems = newItems;
      }
    }

    if (control.cluster.length > 0) {
      const allClustersKeywords = uniq(
        flatten(clusters.filter((c) => c?.keyword && control.cluster.includes(c.keyword)).map((c) => c?.similar || [])),
      ).map((kw) => kw.keyword);
      finalItems = finalItems.filter((kw) => {
        return allClustersKeywords.includes(kw.keyword);
      });
    }

    if (control.semanticCluster.length > 0) {
      const cluster = uniq(flatten(control.semanticCluster.map((c) => semanticClusters[c])));
      finalItems = finalItems.filter((kw) => cluster.includes(kw.keyword));
    }

    if (control.domain.length > 0) {
      finalItems = finalItems.filter((kw) => {
        const allUrls = (kw.urlsTop || []).map((pos) => pos.url).filter((url) => url !== '' && url !== undefined);
        if (kw.featuredSnippet && kw.featuredSnippet.url) {
          allUrls.push(kw.featuredSnippet.url);
        }
        return control.domain.some((dom) => allUrls.some((url) => url?.includes(dom)));
      });
    }

    if (control.competitor.length > 0) {
      finalItems = finalItems.filter((kw) => {
        const allUrls = (kw.urlsTop || []).map((pos) => pos.url).filter((url) => url !== '' && url !== undefined);
        if (kw.featuredSnippet && kw.featuredSnippet.url) {
          allUrls.push(kw.featuredSnippet.url);
        }
        return control.competitor.some((dom) => allUrls.some((url) => url?.includes(dom)));
      });
    }

    if (control.ewPattern.length > 0) {
      finalItems = finalItems.filter((kw) => {
        const allUrls = (kw.urlsTop || []).map((pos) => pos.url).filter((url) => url !== '' && url !== undefined);
        if (kw.featuredSnippet && kw.featuredSnippet.url) {
          allUrls.push(kw.featuredSnippet.url);
        }
        return control.ewPattern.some((dom) => allUrls.some((url) => url?.includes(dom)));
      });
    }

    if (control.minVol !== undefined) {
      finalItems = finalItems.filter((kw) => control.minVol !== undefined && (kw.volume || 0) >= control.minVol);
    }

    if (control.maxVol !== undefined) {
      finalItems = finalItems.filter((kw) => control.maxVol !== undefined && (kw.volume || 0) <= control.maxVol);
    }

    if (control.ignore) {
      const terms = control.ignore.split(',').map((s) => s.trim().toLowerCase());
      finalItems = finalItems.filter((kw) => {
        for (const ignore of terms) {
          const reg = getWordBoundaryRegex(ignore);
          if (reg.test(kw.keyword)) {
            return false;
          }
        }
        return true;
      });
    }

    if (control.serpFeaturesFilter.length > 0) {
      finalItems = finalItems.filter((kw) => {
        if (!kw.serpFeatures) {
          return false;
        }
        return control.serpFeaturesFilter.some((f) => kw.serpFeatures?.includes(f));
      });
    }

    let newItems = [];
    if (control.search) {
      let searches: string[] = [control.search];
      if (control.search.includes(',')) {
        searches = control.search.split(',').map((s) => s.trim());
      }

      const negatives = searches.filter((s) => s.startsWith('-')).map((s) => s.slice(1));
      const nonNegatives = searches.filter((s) => !s.startsWith('-'));

      for (const kw of finalItems) {
        let found = 0;

        let isNegative = false;
        for (const s of negatives) {
          if (control.exactSearch) {
            const reg = getWordBoundaryRegex(s);
            if (reg.test(kw.keyword)) {
              isNegative = true;
              break;
            }
          } else if (kw.keyword.includes(s)) {
            isNegative = true;
            break;
          }
        }

        if (isNegative) {
          continue;
        }

        for (const s of nonNegatives) {
          if (control.exactSearch) {
            const reg = getWordBoundaryRegex(s);
            if (reg.test(kw.keyword)) {
              found++;
            }
          } else if (kw.keyword.includes(s)) {
            found++;
          }
        }

        if (control.orSearch) {
          if (found > 0) {
            newItems.push(kw);
          }
        } else if (found === nonNegatives.length) {
          newItems.push(kw);
        }
      }
    } else {
      newItems = finalItems;
    }

    return sortBy(newItems, (kw) => {
      if (control.sort === 'ew') {
        const score = kw.ewScore;
        if (score === undefined) {
          return null;
        } else if (score === 0) {
          return 0;
        }
        return -score;
      } else if (control.sort === 'volume') {
        const volume = kw.volume;
        if (volume === undefined) {
          return null;
        } else if (volume === 0) {
          return 0;
        }
        return -volume;
      } else if (control.sort === 'ranking') {
        const rankingPosition = kw.rankingPosition;
        if (rankingPosition === undefined) {
          return null;
        } else if (rankingPosition === 0) {
          return 0;
        }
        return rankingPosition;
      }

      return null;
    });
  }, [base, clusters, control, items, semanticClusters]);

  const filteredTerms = useMemo(() => {
    if (!base || !base.terms || !base.terms.length || !items || !items.length) {
      return [];
    }

    const newTerms = base.terms.map((term) => {
      const hasTerm = items.some((kw) => {
        const reg = getWordBoundaryRegex(term.term);
        return reg.test(kw.keyword);
      });

      if (hasTerm) {
        return term;
      }

      const newChildren: IDiscoveryTermChild[] = term.children.filter((child) => {
        return items.some((kw) => {
          const reg = getWordBoundaryRegex(child.term);
          return reg.test(kw.keyword);
        });
      });

      if (newChildren.length === 0) {
        return undefined;
      }

      const newTerm: IDiscoveryTerm = {
        term: term.term,
        count: term.count,
        children: newChildren,
      };

      return newTerm;
    });

    const filterUndefined = (term: IDiscoveryTerm | undefined): term is IDiscoveryTerm => term !== undefined;
    return newTerms.filter(filterUndefined);
  }, [base, items]);

  const pills = useMemo(() => {
    if (!items || items.length === 0) {
      return [];
    }
    const _pills: string[] = [];
    const allPills = uniq(flatten(items.map((item) => item.pills))).filter((pill) => pill !== '' && pill !== undefined);
    const allKeywords = items.map((item) => item.keyword);
    for (const pill of allPills) {
      if (!pill) {
        continue;
      }
      const regex = getWordBoundaryRegex(pill);
      if (!allKeywords.some((keyword) => regex.test(keyword))) {
        _pills.push(pill);
      }
    }
    return _pills;
  }, [items]);

  const verbs = useMemo(() => {
    if (!items || items.length === 0 || !base || !base.verbs || base.verbs.length === 0) {
      return {};
    }
    const _verbs: Record<string, number> = {};
    for (const verb of base.verbs) {
      const count = items.filter((item) => item.lemmas?.includes(verb)).length;
      if (count > 0) {
        _verbs[verb] = count;
      }
    }
    return _verbs;
  }, [items, base]);

  const competitors = useMemo(() => {
    const _competitors: Array<{ value: string; count: number }> = [];

    if (!items || items.length === 0 || !base || !base.competitorPatterns || base.competitorPatterns.length === 0) {
      return _competitors;
    }

    for (const pattern of base.competitorPatterns) {
      const count = items.filter((item) => item.urlsTop?.some((pos) => pos.url?.includes(pattern))).length;
      _competitors.push({
        count,
        value: pattern,
      });
    }

    return _competitors;
  }, [base, items]);

  const ewPatterns = useMemo(() => {
    const _patterns: Array<{ value: string; count: number }> = [];

    if (!items || items.length === 0 || !base || !base.easyWinsPatternsUser || base.easyWinsPatternsUser.length === 0) {
      return _patterns;
    }

    for (const pattern of base.easyWinsPatternsUser) {
      const count = items.filter((item) =>
        item.urlsTop?.some((pos) => {
          if (!pos.url) {
            return false;
          }
          const reg = getWordBoundaryRegex(pattern);
          return reg.test(pos.url);
        }),
      ).length;

      _patterns.push({
        value: pattern,
        count,
      });
    }

    return _patterns;
  }, [base, items]);

  const domains = useMemo(() => {
    const _domains: Array<{ value: string; count: number }> = [];

    if (!items || items.length === 0) {
      return _domains;
    }

    for (const item of items) {
      if (!item.urlsTop) {
        continue;
      }

      const notUndefined = (url: string | undefined): url is string => url !== '' && url !== undefined;
      const allUrls: string[] = item.urlsTop.map((url) => url.url).filter(notUndefined);
      if (item.featuredSnippet && item.featuredSnippet.url) {
        allUrls.push(item.featuredSnippet.url);
      }

      for (const url of allUrls) {
        let domain = new URL(url).hostname;
        if (domain.startsWith('www.')) {
          domain = domain.replace(/^www\./, '');
        }

        const index = _domains.findIndex((d) => d.value === domain);
        if (index === -1) {
          _domains.push({ value: domain, count: 1 });
        } else {
          _domains[index].count++;
        }
      }
    }

    return _domains;
  }, [items]);

  const doRemoveKeywords = trpc.useMutation('discovery:delete-keywords', {
    onSuccess: (data) => {
      if (data.success) {
        clearFilters();
        doGetBase.refetch();
        doGetItems.refetch();
      }
    },
  });

  const doGetSerps = trpc.useMutation('discovery:get-serps', {
    onSuccess: (data) => {
      if (data.success) {
        clearFilters();
        doGetTasks.refetch();
      }
    },
  });

  const doExpandKeywords = trpc.useMutation('discovery:expand', {
    onSuccess: async () => {
      clearFilters();
      setTimeout(async () => {
        await doGetTasks.refetch();
      }, 2_000);
    },
  });

  const doGetTasks = trpc.useQuery(['discovery:tasks', { reportId: window.__id }], {
    onSuccess: async (data) => {
      if (data.tasks) {
        if (data.tasks?.some((task) => task.status === REPORT_STATUS_PROCESSING || task.status === REPORT_STATUS_QUEUED)) {
          setTimeout(async () => {
            await doGetTasks.refetch();
          }, 8_000);
        } else {
          doGetBase.refetch();
          doGetItems.refetch();
          doGetClusters.refetch();
        }
      }
    },
  });

  const doRemoveGroup = trpc.useMutation('discovery:delete-group', {
    onSuccess: async (data) => {
      if (data.success) {
        clearFilters();
        await doGetBase.refetch();
      }
    },
  });

  const doUpdateGroupKeywords = trpc.useMutation('discovery:update-group', {
    onSuccess: async (data) => {
      if (data.success) {
        await doGetBase.refetch();
      }
    },
  });

  const doUpdateCompetitors = trpc.useMutation('discovery:update-competitors', {
    onSuccess: async (data) => {
      if (data.success) {
        clearFilters();
        await doGetBase.refetch();
        await doGetItems.refetch();
      }
    },
  });

  const doUpdateEwPatterns = trpc.useMutation('discovery:update-ew-patterns', {
    onSuccess: async (data) => {
      if (data.success) {
        clearFilters();
        await doGetBase.refetch();
        await doGetItems.refetch();
      }
    },
  });

  const downloadKeywords = useCallback(
    async (filtered: boolean) => {
      const _items = filtered ? filteredItems : items;

      if (!_items || _items.length === 0 || !base) {
        return;
      }

      const allKeywords = _items.map((kw) => kw.keyword);

      const headerKeywords: Row = [
        { value: 'keyword' },
        { value: 'volume' },
        { value: 'cpc' },
        { value: 'competition' },
        { value: 'serp_features' },
        { value: 'bolded' },
        { value: 'related' },
        { value: 'paa' },
        { value: 'easy_wins_score' },
        { value: 'easy_wins_matches' },
        { value: 'found_in_paa' },
        { value: 'title_exact_match' },
        { value: 'title_partial_match' },
        { value: 'clusters' },
      ];

      const keywordsData = [headerKeywords];
      for (const item of _items) {
        keywordsData.push([
          { value: item.keyword, type: String },
          { value: item.volume, type: Number },
          { value: item.cpc, type: Number },
          { value: item.competition, type: Number },
          { value: (item.serpFeatures || []).join(','), type: String },
          { value: (item.bolded || []).join(','), type: String },
          { value: (item.related || []).join(','), type: String },
          { value: (item.paa || []).join(','), type: String },
          { value: item.ewScore || 0, type: Number },
          { value: (item.ewMatches || []).join(','), type: String },
          { value: item.isPaa ? 'yes' : 'no', type: String },
          { value: item.titleExactMatch ? 'yes' : 'no', type: String },
          { value: item.titlePartialMatch ? 'yes' : 'no', type: String },
          { value: (item.clusters || []).join(','), type: String },
        ]);
      }

      const headerSerps: Row = [
        { value: 'position' },
        { value: 'keyword' },
        { value: 'url' },
        { value: 'title' },
        { value: 'description' },
        { value: 'is_featured_snippet' },
      ];

      const serpsData = [headerSerps];
      for (const item of _items) {
        if (!item.urlsTop) {
          continue;
        }

        if (item.featuredSnippet) {
          serpsData.push([
            { value: 0, type: Number },
            { value: item.keyword, type: String },
            { value: item.featuredSnippet.url, type: String },
            { value: item.featuredSnippet.title, type: String },
            { value: item.featuredSnippet.description, type: String },
            { value: 'yes', type: String },
          ]);
        }

        for (const serp of item.urlsTop) {
          serpsData.push([
            { value: serp.position, type: Number },
            { value: item.keyword, type: String },
            { value: serp.url, type: String },
            { value: serp.title, type: String },
            { value: serp.description, type: String },
            { value: 'no', type: String },
          ]);
        }
      }

      const headerSerpsUrls: Row = [{ value: 'keyword' }, { value: 'position' }, { value: 'url' }];
      const serpsDataUrls = [headerSerpsUrls];
      for (const item of _items) {
        if (!item.urlsAll) {
          continue;
        }

        for (const serp of item.urlsAll) {
          serpsDataUrls.push([
            { value: item.keyword, type: String },
            { value: serp.position, type: Number },
            { value: serp.url, type: String },
          ]);
        }
      }

      const headersClusters: Row = [{ value: 'cluster' }, { value: 'keyword' }, { value: 'volume' }, { value: 'cluster_volume' }];
      const clustersData = [headersClusters];
      for (const cluster of clusters || []) {
        if (!cluster?.similar.some((kw) => allKeywords.includes(kw.keyword))) {
          continue;
        }

        for (const item of cluster.similar || []) {
          clustersData.push([
            { value: cluster.keyword, type: String },
            { value: item.keyword, type: String },
            { value: item.volume || 0, type: Number },
            { value: cluster.volume || 0, type: Number },
          ]);
        }
      }

      const data = [keywordsData, serpsData, serpsDataUrls, clustersData];
      const sheets = ['Keywords', 'SERPs', 'SERPs URLs', 'Clusters'];

      const groupHeader = [{ value: 'group_name' }, ...headerKeywords];
      if (base?.groups) {
        for (const group of base.groups) {
          if (!group.keywords.some((kw) => allKeywords.includes(kw))) {
            continue;
          }

          const groupData = [groupHeader];
          for (const kw of group.keywords) {
            const keyword = _items.find((item) => item.keyword === kw);

            if (!keyword) {
              continue;
            }

            groupData.push([
              { value: group.name, type: String },
              { value: keyword.keyword, type: String },
              { value: keyword.volume, type: Number },
              { value: keyword.cpc, type: Number },
              { value: keyword.competition, type: Number },
              { value: (keyword.serpFeatures || []).join(','), type: String },
              { value: (keyword.bolded || []).join(','), type: String },
              { value: (keyword.related || []).join(','), type: String },
              { value: (keyword.paa || []).join(','), type: String },
              { value: keyword.ewScore || 0, type: Number },
              { value: (keyword.ewMatches || []).join(','), type: String },
              { value: keyword.isPaa ? 'yes' : 'no', type: String },
            ]);
          }

          if (groupData.length) {
            data.push(groupData);
            sheets.push(group.name);
          }
        }
      }

      await writeXlsxFile(data, { sheets, fileName: `${cleanKeyword(base.name)}-keywords.xlsx` });
    },
    [base, clusters, filteredItems, items],
  );

  useEffect(() => {
    if (!hasFilters && filteredItems.length === 0) {
      doGetItems.refetch();
    }
  }, [doGetItems, filteredItems.length, hasFilters]);

  const reportNotFinished = base?.status !== REPORT_STATUS_COMPLETED;
  const isLoading =
    doRemoveKeywords.isLoading ||
    doGetSerps.isLoading ||
    doGetItems.isLoading ||
    doUpdateGroupKeywords.isLoading ||
    doRemoveGroup.isLoading ||
    doGetSerps.isLoading ||
    reportNotFinished;
  const hasRunningTasks = reportNotFinished || getHasRunningTasks((doGetTasks.data?.tasks || []) as IReportTask[]);

  return {
    base,
    verbs,
    items,
    pills,
    domains,
    clusters,
    isLoading,
    ewPatterns,
    hasFilters,
    competitors,
    filteredItems,
    hasRunningTasks,
    semanticClusters,
    reportNotFinished,
    terms: filteredTerms,
    allEwPatterns: base?.easyWinsPatterns || [],
    clearFilters,
    download: downloadKeywords,
    doUpdateCompetitors: (competitors: string[]) => {
      if (base && base._id) {
        doUpdateCompetitors.mutate({
          competitors,
          reportId: base._id,
        });
      }
    },
    doUpdateEwPatterns: (ewPatterns: string[], ewDefaults: boolean) => {
      if (base && base._id) {
        doUpdateEwPatterns.mutate({
          ewDefaults,
          ewPatterns,
          reportId: base._id,
        });
      }
    },
    doGetSerps: (full: boolean) => {
      if (base && base._id) {
        doGetSerps.mutate({
          reportId: base._id,
          keywords: full ? items.map((kw) => kw.keyword) : control.selected,
        });
      }
    },
    doAddGroup: (group: string) => {
      if (base && base._id) {
        doUpdateGroupKeywords.mutate({
          reportId: base._id,
          group,
          keywords: [],
          action: 'add',
        });
      }
    },
    doRemoveGroup: (group: string) => {
      if (base && base._id) {
        doRemoveGroup.mutate({ group, reportId: base._id });
      }
    },
    doExpandKeywords: (
      seed: string | undefined,
      searchType: typeof SEARCH_TYPE_QUESTIONS | typeof SEARCH_TYPE_WILDCARD | typeof SEARCH_TYPE_CUSTOM | typeof SEARCH_TYPE_URL,
      keywords?: string[],
      url?: string,
    ) => {
      if (base && base._id) {
        doExpandKeywords.mutate({
          seed,
          searchType,
          reportId: base._id,
          url: url || undefined,
          keywords: keywords || undefined,
        });
      }
    },
    doRemoveKeywords: (keywords: string[]) => {
      if (base && base._id) {
        doRemoveKeywords.mutate({
          reportId: base._id,
          keywords,
        });
      }
    },
    doUpdateGroupKeywords: (group: string, action: 'add' | 'remove') => {
      if (base && base._id) {
        doUpdateGroupKeywords.mutate({
          reportId: base._id,
          group,
          action,
          keywords: control.selected,
        });
      }
    },
  };
};

const getHasRunningTasks = (tasks: Pick<IReportTask, 'uuid' | 'type' | 'status'>[]) => {
  return tasks.some((task) => {
    const isWaiting = task.status === REPORT_STATUS_PROCESSING || task.status === REPORT_STATUS_QUEUED;
    if (
      isWaiting &&
      (task.type === 'discovery-serps-similarity' || task.type === 'discovery-keywords' || task.type === 'discovery-verbs')
    ) {
      return false;
    }

    return isWaiting;
  });
};

export default useDiscovery;
