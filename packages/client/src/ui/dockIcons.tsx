import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ScenesIcon = (
  <Icon>
    <rect x="4" y="5" width="12" height="10" rx="1.2" />
    <path d="M8 15.5V18a1 1 0 0 0 1 1h11V9a1 1 0 0 0-1-1h-3" />
  </Icon>
);

export const TokensIcon = (
  <Icon>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M6.2 19c.7-3.2 3-5 5.8-5s5.1 1.8 5.8 5" />
  </Icon>
);

export const InspectIcon = (
  <Icon>
    <circle cx="11" cy="11" r="6" />
    <path d="M16 16.5 20 20.5" />
  </Icon>
);

export const PartyIcon = (
  <Icon>
    <circle cx="9" cy="8.5" r="2.6" />
    <path d="M4.4 18.5c.6-2.6 2.4-4 4.6-4s4 1.4 4.6 4" />
    <circle cx="16.2" cy="9.2" r="2.2" />
    <path d="M15 14.4c1.7.3 3.1 1.5 3.7 3.6" />
  </Icon>
);

export const SheetIcon = (
  <Icon>
    <path d="M8 4.5h6.2L19 9.3V19.5H8a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 8 4.5Z" />
    <path d="M14 4.5V9h5" />
    <path d="M10 12.5h6M10 16h6" />
  </Icon>
);
