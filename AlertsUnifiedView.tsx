import { useTranslation } from 'react-i18next';
import { type VerifiedFeed } from '@/hooks/useVerifiedFeeds';

interface LinkStatusBadgeProps {
  feed: VerifiedFeed;
}

export function LinkStatusBadge({ feed }: LinkStatusBadgeProps) {
  const { t } = useTranslation();
  const status = feed.source_status || 'unchecked';
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
          <i className="ri-checkbox-circle-line text-[9px]" />
          {t('feeds.linkStatus.activeBadge')}
        </span>
      );
    case 'warning':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">
          <i className="ri-alert-line text-[9px]" />
          {t('feeds.linkStatus.warningBadge')}
        </span>
      );
    case 'dead':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-red-50 text-red-700 border-red-200">
          <i className="ri-close-circle-line text-[9px]" />
          {t('feeds.linkStatus.deadBadge')}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border bg-gray-50 text-gray-500 border-gray-200">
          <i className="ri-question-line text-[9px]" />
          {t('feeds.linkStatus.uncheckedBadge')}
        </span>
      );
  }
}

// Legacy function wrapper for backward compatibility
export function linkStatusBadge(feed: VerifiedFeed) {
  return <LinkStatusBadge feed={feed} />;
}