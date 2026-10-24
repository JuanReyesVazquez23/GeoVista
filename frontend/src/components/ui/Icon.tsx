import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'compass'
  | 'arrow-up-right'
  | 'arrow-right'
  | 'arrow-down'
  | 'heart'
  | 'map-pin'
  | 'search'
  | 'close'
  | 'play'
  | 'pause'
  | 'skip-back'
  | 'skip-forward'
  | 'globe'
  | 'download'
  | 'refresh'
  | 'lock'
  | 'wrench'
  | 'plus'
  | 'camera'
  | 'map'
  | 'street'
  | 'check'
  | 'spark'
  | 'external'
  | 'chevron-down';

const HEART =
  'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z';

const ICONS: Record<IconName, ReactNode> = {
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1Z" />
    </>
  ),
  'arrow-up-right': (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4 12h16" />
      <path d="m14 6 6 6-6 6" />
    </>
  ),
  'arrow-down': (
    <>
      <path d="M12 4v16" />
      <path d="m6 14 6 6 6-6" />
    </>
  ),
  heart: <path d={HEART} />,
  'map-pin': (
    <>
      <path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  play: <path d="M8 5v14l11-7L8 5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.2" height="14" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.8" y="5" width="3.2" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  'skip-back': (
    <>
      <path d="M19 6 9 12l10 6V6Z" />
      <path d="M5 5v14" />
    </>
  ),
  'skip-forward': (
    <>
      <path d="m5 6 10 6L5 18V6Z" />
      <path d="M19 5v14" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.2 12h17.6" />
      <path d="M12 3a13.5 13.5 0 0 1 0 18 13.5 13.5 0 0 1 0-18Z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  wrench: (
    <path d="M14.5 6.5a4.5 4.5 0 0 0-5.8 5.8l-5.2 5.2a2.1 2.1 0 0 0 3 3l5.2-5.2a4.5 4.5 0 0 0 5.8-5.8l-2.5 2.5-3-3 2.5-2.5Z" />
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  map: (
    <>
      <path d="m9 18-6 3V7l6-3 6 3 6-3v14l-6 3-6-3Z" />
      <path d="M9 4v14" />
      <path d="M15 7v14" />
    </>
  ),
  street: (
    <>
      <path d="M4 20 8 4" />
      <path d="M20 20 16 4" />
      <path d="M9.5 16h5" />
      <path d="M10.8 11h2.4" />
      <path d="M12 7v.01" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  spark: (
    <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
};

interface Props extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  filled?: boolean;
}

export default function Icon({ name, size = 18, filled = false, ...rest }: Props) {
  const content =
    name === 'heart' && filled ? (
      <path d={HEART} fill="currentColor" stroke="none" />
    ) : (
      ICONS[name]
    );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
}
