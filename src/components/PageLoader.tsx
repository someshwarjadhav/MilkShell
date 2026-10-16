import type * as React from 'react';
export const PageLoader: React.FC = () => {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <span className="absolute inset-0 animate-ring rounded-full bg-brand/30" />
          <svg viewBox="0 0 32 32" className="relative h-16 w-16 animate-drift text-brand"><path d="M16 3c5 6.5 9 11 9 16.2a9 9 0 0 1-18 0C7 14 11 9.5 16 3z" fill="currentColor" /></svg>
        </div>
        <p className="text-sm font-semibold text-mute">Loading page</p>
      </div>
    </div>
  );
};
