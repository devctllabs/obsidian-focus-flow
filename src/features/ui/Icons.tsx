import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function InfoIcon(props: IconProps) {
  return <IconFrame {...props}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="12" cy="7" r="1" fill="currentColor" /></IconFrame>;
}

export function RefreshIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M20 4v5h-5M4 20v-5h5M4.8 9a7.5 7.5 0 0 1 12.4-3.2L20 9M4 15l2.8 3.2A7.5 7.5 0 0 0 19.2 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconFrame>;
}

export function SettingsIcon(props: IconProps) {
  return <IconFrame {...props}><path d="m9 3-.5 2-2 1.2-2-.6L3 8.4 4.5 10v2L3 13.6l1.5 2.8 2-.6 2 1.2.5 2h3l.5-2 2-1.2 2 .6 1.5-2.8L16.5 12v-2L18 8.4l-1.5-2.8-2 .6-2-1.2-.5-2H9Z" transform="translate(1.5 1)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" /></IconFrame>;
}

export function FilterIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M4 7h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="9" cy="7" r="2.5" fill="var(--ff-background)" stroke="currentColor" strokeWidth="1.8" /><circle cx="15" cy="17" r="2.5" fill="var(--ff-background)" stroke="currentColor" strokeWidth="1.8" /></IconFrame>;
}

export function PlusIcon(props: IconProps) {
  return <IconFrame {...props}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></IconFrame>;
}

export function PlayIcon(props: IconProps) {
  return <IconFrame {...props}><path d="m9 5 10 7-10 7V5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" /></IconFrame>;
}

export function CheckIcon(props: IconProps) {
  return <IconFrame {...props}><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></IconFrame>;
}

export function GripIcon(props: IconProps) {
  return <IconFrame {...props}>{[8, 16].flatMap((cx) => [6, 12, 18].map((cy) => <circle cx={cx} cy={cy} fill="currentColor" key={`${cx}:${cy}`} r="1.2" />))}</IconFrame>;
}

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
      {...props}
    >
      {children}
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="5" cy="12" fill="currentColor" r="1.5" />
      <circle cx="12" cy="12" fill="currentColor" r="1.5" />
      <circle cx="19" cy="12" fill="currentColor" r="1.5" />
    </IconFrame>
  );
}

export function ChevronIcon(props: IconProps & { direction?: 'down' | 'right' | 'left' }) {
  const { direction = 'down', ...rest } = props;
  const points = direction === 'right'
    ? '9 18 15 12 9 6'
    : direction === 'left'
      ? '15 18 9 12 15 6'
      : '6 9 12 15 18 9';
  return (
    <IconFrame {...rest}>
      <polyline points={points} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </IconFrame>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-4-4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </IconFrame>
  );
}

export function AttentionIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 3 2.8 19h18.4L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 8v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="16.5" fill="currentColor" r="1" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </IconFrame>
  );
}
