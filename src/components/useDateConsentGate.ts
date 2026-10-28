import { useState } from 'react';
import { useInlineConsent } from './ConsentBoundary';
import { DATE_CONSENT_REQUIRED_MESSAGE } from './DateConsentField';

/**
 * The mark under a date field is the consent for that date. `confirm()` resolves to null when the date may be sent
 * (ticked now, or given earlier and still valid on the server) and to a message to show otherwise. It never opens a dialog.
 */
export function useDateConsentGate() {
  const inline = useInlineConsent();
  const [checked, setChecked] = useState(false);
  const confirm = async (): Promise<string | null> => {
    if (!inline.accepted && !checked) return DATE_CONSENT_REQUIRED_MESSAGE;
    if (!inline.accepted) {
      try {
        await inline.accept();
      } catch {
        return 'Согласие не сохранено. Попробуйте ещё раз.';
      }
    } else if (inline.restored && !(await inline.verify())) {
      setChecked(false);
      return DATE_CONSENT_REQUIRED_MESSAGE;
    }
    return null;
  };
  return { showMark: !inline.accepted, checked, setChecked, confirm };
}
