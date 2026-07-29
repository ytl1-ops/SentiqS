import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type ShareChannel = 'email' | 'whatsapp' | 'telegram' | 'sms';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  itemTitle: string;
  itemType: string;
}

export default function ShareModal({ open, onClose, itemTitle, itemType }: ShareModalProps) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<ShareChannel>('email');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!open) return null;

  const needsEmail = channel === 'email';
  const needsPhone = channel === 'whatsapp' || channel === 'telegram' || channel === 'sms';

  const resetForm = () => {
    setChannel('email');
    setName('');
    setRole('');
    setOrganization('');
    setRecipient('');
    setMessage('');
    setStatus('idle');
  };

  const handleSend = () => {
    setStatus('sending');
    // Simulate sending
    setTimeout(() => {
      setStatus('sent');
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1500);
    }, 1200);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const channelIcon = (ch: ShareChannel) => {
    const map: Record<ShareChannel, string> = {
      email: 'ri-mail-line',
      whatsapp: 'ri-whatsapp-line',
      telegram: 'ri-telegram-line',
      sms: 'ri-message-2-line',
    };
    return map[ch];
  };

  const channels: { key: ShareChannel; label: string; color: string }[] = [
    { key: 'email', label: t('share.channelEmail'), color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' },
    { key: 'whatsapp', label: t('share.channelWhatsapp'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
    { key: 'telegram', label: t('share.channelTelegram'), color: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100' },
    { key: 'sms', label: t('share.channelSms'), color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-xl border border-gray-100 w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-sentiqs-navy">{t('share.title')}</h3>
            <p className="text-[10px] text-sentiqs-gray-text mt-0.5 line-clamp-1">
              {itemType} — {itemTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-sentiqs-gray-text transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Identity section */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <i className="ri-user-settings-line text-sentiqs-navy text-sm" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sentiqs-navy">
                {t('share.identity')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider block mb-1">
                  {t('share.identityName')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-sentiqs-navy placeholder:text-gray-300 focus:outline-none focus:border-sentiqs-navy transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider block mb-1">
                  {t('share.identityRole')}
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Directeur Sûreté"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-sentiqs-navy placeholder:text-gray-300 focus:outline-none focus:border-sentiqs-navy transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider block mb-1">
                  {t('share.identityOrg')}
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="SentiqS Group"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-sentiqs-navy placeholder:text-gray-300 focus:outline-none focus:border-sentiqs-navy transition-colors"
                />
              </div>
            </div>
            <p className="text-[9px] text-sentiqs-gray-text mt-2">{t('share.identityHint')}</p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-50" />

          {/* Channel selection */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <i className="ri-share-forward-line text-sentiqs-navy text-sm" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sentiqs-navy">
                {t('share.channel')}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => { setChannel(ch.key); setRecipient(''); }}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-[10px] font-semibold transition-all ${
                    channel === ch.key
                      ? `${ch.color} ring-2 ring-offset-1 ring-current/30`
                      : 'bg-gray-50 text-sentiqs-gray-text border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <i className={`${channelIcon(ch.key)} text-base`} />
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider block mb-1.5">
              {t('share.recipient')}
            </label>
            <input
              type={needsEmail ? 'email' : 'tel'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={needsEmail ? t('share.recipientEmail') : t('share.recipientPhone')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-sentiqs-navy placeholder:text-gray-300 focus:outline-none focus:border-sentiqs-navy transition-colors"
            />
          </div>

          {/* Message */}
          <div>
            <label className="text-[10px] font-semibold text-sentiqs-gray-text uppercase tracking-wider block mb-1.5">
              {t('share.message')}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('share.messagePlaceholder')}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs text-sentiqs-navy placeholder:text-gray-300 focus:outline-none focus:border-sentiqs-navy transition-colors resize-none"
            />
            <p className="text-[9px] text-sentiqs-gray-text mt-1 text-right">{message.length}/500</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {status === 'sent' ? (
            <div className="flex items-center gap-2 text-emerald-600 text-xs font-semibold">
              <i className="ri-checkbox-circle-fill text-sm" />
              {t('share.sent')}
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center gap-2 text-red-500 text-xs font-semibold">
              <i className="ri-error-warning-fill text-sm" />
              {t('share.error')}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-[11px] font-semibold text-sentiqs-gray-text hover:bg-gray-50 border border-gray-200 transition-colors whitespace-nowrap"
            >
              {t('share.close')}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={status === 'sending' || status === 'sent'}
              className="px-5 py-2 rounded-lg text-[11px] font-semibold text-white bg-sentiqs-navy hover:bg-sentiqs-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {status === 'sending' ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-sm" />
                  {t('share.sending')}
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill text-sm" />
                  {t('share.send')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}