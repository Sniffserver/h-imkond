import React, { useEffect, useState } from 'react';
import { a11yAnnouncer } from '../services/a11y/a11yAnnouncer';

export const A11yLiveAnnouncer: React.FC = () => {
  const [announcements, setAnnouncements] = useState({ polite: '', assertive: '' });

  useEffect(() => {
    const unsubscribe = a11yAnnouncer.subscribe((current) => {
      setAnnouncements(current);
    });
    return unsubscribe;
  }, []);

  return (
    <div id="a11y-live-announcer-container" className="sr-only pointer-events-none" aria-hidden="false">
      {/* Polite live region for general updates (peers, messages, actions) */}
      <div
        id="a11y-live-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements.polite}
      </div>

      {/* Assertive live region for critical safety / SOS beacons */}
      <div
        id="a11y-live-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {announcements.assertive}
      </div>
    </div>
  );
};
