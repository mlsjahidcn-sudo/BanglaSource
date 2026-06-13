// Inline-SVG icon set used in the portal sidebar.
// All icons are stroke-only at 1.4-1.5px to match the existing nav aesthetic.

type IconProps = { className?: string; size?: number };

const wrap = (size: number, children: React.ReactNode, className?: string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const IconHome = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M2.5 7L8 2.5l5.5 4.5" />
      <path d="M3.5 6.5V13a.5.5 0 00.5.5h3v-4h2v4h3a.5.5 0 00.5-.5V6.5" />
    </>,
    className,
  );

export const IconCart = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M2 2h2l1.6 8.4a1 1 0 001 .8h5.5a1 1 0 001-.78L14 5H4.2" />
      <circle cx="6" cy="13.5" r="0.7" />
      <circle cx="11.5" cy="13.5" r="0.7" />
    </>,
    className,
  );

export const IconQuote = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M3 4h10v8H3z" />
      <path d="M5 7h6M5 9h4" />
    </>,
    className,
  );

export const IconRFQ = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M3 2h7l3 3v9H3z" />
      <path d="M10 2v3h3" />
      <path d="M5.5 8h5M5.5 10.5h3" />
    </>,
    className,
  );

export const IconPackage = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M2.5 5.5L8 2.5l5.5 3v5L8 13.5l-5.5-3z" />
      <path d="M2.5 5.5L8 8.5l5.5-3M8 8.5V13.5" />
    </>,
    className,
  );

export const IconAddress = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M8 14s-5-4.2-5-8a5 5 0 0110 0c0 3.8-5 8-5 8z" />
      <circle cx="8" cy="6" r="1.8" />
    </>,
    className,
  );

export const IconUser = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <circle cx="8" cy="6" r="2.5" />
      <path d="M3 13.5c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" />
    </>,
    className,
  );

export const IconSettings = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <circle cx="8" cy="8" r="1.8" />
      <path d="M8 2v1.5M8 12.5V14M14 8h-1.5M3.5 8H2M12.2 3.8l-1 1M4.8 11.2l-1 1M12.2 12.2l-1-1M4.8 4.8l-1-1" />
    </>,
    className,
  );

export const IconSync = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M3 8a5 5 0 018.5-3.5L13 6" />
      <path d="M13 3v3h-3" />
      <path d="M13 8a5 5 0 01-8.5 3.5L3 10" />
      <path d="M3 13v-3h3" />
    </>,
    className,
  );

export const IconChart = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M2 13h12" />
      <path d="M4 11V7M7 11V4M10 11V8M13 11V6" />
    </>,
    className,
  );

export const IconAlert = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M8 2l6 10H2z" />
      <path d="M8 6v3M8 11v0.5" />
    </>,
    className,
  );

export const IconSearch = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L13 13" />
    </>,
    className,
  );

export const IconBell = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M3.5 11.5h9L11 9V6a3 3 0 00-6 0v3l-1.5 2.5z" />
      <path d="M6.5 13.5a1.5 1.5 0 003 0" />
    </>,
    className,
  );

export const IconTraffic = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M2 12L5 8l3 2 4-5" />
      <circle cx="5" cy="8" r="0.8" />
      <circle cx="8" cy="10" r="0.8" />
      <circle cx="12" cy="5" r="0.8" />
    </>,
    className,
  );

export const IconUsers = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <circle cx="6" cy="6" r="2.2" />
      <path d="M2 12.5c.5-2 2-3 4-3s3.5 1 4 3" />
      <circle cx="11" cy="5" r="1.8" />
      <path d="M11 8.5c1.5 0 2.5.8 3 2" />
    </>,
    className,
  );

export const IconAI = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M8 1.5l1.7 3.3 3.6.5-2.6 2.5.6 3.6L8 9.6 4.7 11.4l.6-3.6L2.7 5.3l3.6-.5L8 1.5z" />
      <circle cx="12" cy="11.5" r="0.8" />
      <circle cx="3" cy="11.5" r="0.8" />
    </>,
    className,
  );

// Icon for the "Import from Pinduoduo / Taobao" admin page.
// Drawn as a downward arrow into a tray — represents "fetch
// from a source into our catalog".
export const IconImport = ({ size = 16, className }: IconProps) =>
  wrap(
    size,
    <>
      <path d="M8 2v8m0 0l-3-3m3 3l3-3" />
      <path d="M3 12v1.5A1.5 1.5 0 004.5 15h9a1.5 1.5 0 001.5-1.5V12" />
    </>,
    className,
  );
