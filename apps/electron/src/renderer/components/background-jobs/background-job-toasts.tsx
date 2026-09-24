import { useQuery } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import { useEffect, useRef, useState } from "react";

import { type BackgroundJobApiItem } from "@frt/shared/background-job/background-job-api-schema.ts";
import { toast } from "@frt/ui/toast.tsx";

import { groupBackgroundJobsByCategory } from "@/renderer/api/background-job/background-job-categories.ts";
import { getBackgroundJobsQueryOptions } from "@/renderer/api/background-job/background-job-queries.ts";
import {
  getNextToastExpiryMilliseconds,
  getToastVisibleBackgroundJobs,
} from "@/renderer/stores/background-job/background-job-toast-visibility.ts";
import {
  type DismissedBackgroundJobPhases,
  getBackgroundJobPhase,
  getBackgroundJobToastType,
  isBackgroundJobToastDismissed,
  pruneDismissedBackgroundJobPhases,
  sortBackgroundJobsForToasts,
  syncBackgroundJobToasts,
} from "@/renderer/stores/background-job/sync-background-job-toasts.ts";

import {
  type BackgroundJobQueueContext,
  getBackgroundJobQueueContext,
} from "./background-job-descriptions.ts";
import { BackgroundJobName } from "./background-job-name.tsx";
import { BackgroundJobToastDescription } from "./background-job-toast-body.tsx";

type BackgroundJobId = BackgroundJobApiItem["id"];

type BackgroundJobToastEntry = {
  readonly job: BackgroundJobApiItem;
  readonly queueContext: BackgroundJobQueueContext;
};

const NO_JOBS: ReadonlyArray<BackgroundJobApiItem> = [];

function getNowMilliseconds(): number {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

function getToastEntries(
  jobs: ReadonlyArray<BackgroundJobApiItem>,
): ReadonlyArray<BackgroundJobToastEntry> {
  const entries = groupBackgroundJobsByCategory(jobs).flatMap((group) => {
    const queueContext = getBackgroundJobQueueContext(group.jobs);

    return group.jobs.map((job) => {
      return { job, queueContext };
    });
  });

  return sortBackgroundJobsForToasts(entries);
}

export function BackgroundJobToasts() {
  const { data: jobs = NO_JOBS } = useQuery({
    ...getBackgroundJobsQueryOptions(),
    select: (snapshot) => {
      return snapshot.jobs;
    },
  });

  const [nowMilliseconds, setNowMilliseconds] = useState(getNowMilliseconds);

  const dismissedRef = useRef<DismissedBackgroundJobPhases>(new Map());
  const openJobIdsRef = useRef<ReadonlySet<BackgroundJobId>>(new Set());
  const visibleJobsRef = useRef<ReadonlyArray<BackgroundJobApiItem>>([]);

  const visibleJobs = getToastVisibleBackgroundJobs(jobs, nowMilliseconds);

  useEffect(() => {
    const nextExpiryMilliseconds = getNextToastExpiryMilliseconds(
      jobs,
      nowMilliseconds,
    );

    if (nextExpiryMilliseconds === undefined) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        setNowMilliseconds(getNowMilliseconds());
      },
      Math.max(0, nextExpiryMilliseconds - getNowMilliseconds()),
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [jobs, nowMilliseconds]);

  useEffect(() => {
    visibleJobsRef.current = visibleJobs;
    dismissedRef.current = pruneDismissedBackgroundJobPhases(
      dismissedRef.current,
      visibleJobs,
    );

    function handleManualClose(jobId: BackgroundJobId): void {
      const job = visibleJobsRef.current.find((visibleJob) => {
        return visibleJob.id === jobId;
      });

      if (job === undefined) {
        return;
      }

      dismissedRef.current = new Map(dismissedRef.current).set(
        jobId,
        getBackgroundJobPhase(job),
      );
    }

    const entries = getToastEntries(visibleJobs).filter(({ job }) => {
      return !isBackgroundJobToastDismissed(job, dismissedRef.current);
    });

    openJobIdsRef.current = syncBackgroundJobToasts({
      closeToast: (jobId) => {
        toast.close(jobId);
      },
      entries,
      openJobIds: openJobIdsRef.current,
      showToast: ({ job, queueContext }, stackOrder) => {
        toast.add({
          data: { size: "compact", stackOrder },
          description: (
            <BackgroundJobToastDescription
              job={job}
              queueContext={queueContext}
            />
          ),
          id: job.id,
          onClose: () => {
            handleManualClose(job.id);
          },
          timeout: 0,
          title: <BackgroundJobName job={job} />,
          type: getBackgroundJobToastType(job),
        });
      },
    });
  });

  return null;
}
