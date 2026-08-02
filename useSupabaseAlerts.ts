interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
  icon?: string;
}

export default function ErrorState({ message, onRetry, retryLabel = 'Réessayer', icon }: ErrorStateProps) {
  return (
    <div className="py-8 text-center text-sentiqs-gray-text text-xs bg-white rounded-lg border border-gray-100">
      {icon && <i className={`${icon} text-2xl mb-2 block text-gray-300`} />}
      {message}
      <button
        type="button"
        onClick={onRetry}
        className="ml-2 text-sentiqs-navy font-semibold underline cursor-pointer"
      >
        {retryLabel}
      </button>
    </div>
  );
}