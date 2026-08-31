interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, actionIcon, onAction }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 py-10 px-6 text-center">
      <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
        <i className={`${icon} text-sentiqs-gray-text text-xl`} />
      </div>
      <h3 className="text-xs font-bold text-sentiqs-navy mb-1">{title}</h3>
      <p className="text-[10px] text-sentiqs-gray-text max-w-sm mx-auto mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-[10px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 px-4 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          {actionIcon && <i className={`${actionIcon} text-xs`} />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}