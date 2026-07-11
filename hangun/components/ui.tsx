// ============================================================
// หารกัน (HanGun) — shared presentational components
// no hooks → usable from both server and client components
// ============================================================

import { colorFor, initial } from '@/lib/format';

const ICON_PATHS: Record<string, string> = {
  back: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3z',
  check: 'M20 6L9 17l-5-5',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  close: 'M18 6L6 18M6 6l12 12',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  users: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  share: 'M16 6l-4-4-4 4M12 2v13M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  list: 'M6 2h12v20l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  chart: 'M3 3v18h18M8 16v-5M13 16V8M18 16v-10',
  camera: 'M3 8h3l2-3h8l2 3h3v12H3zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  wallet: 'M3 7h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V5a2 2 0 0 1 2-2h11M17 13h.01',
  download: 'M12 3v12M7 11l5 5 5-5M5 21h14',
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICON_PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICON_PATHS[name] ?? ''} />
    </svg>
  );
}

type AvatarMember = { id: string; name: string; photoUrl?: string | null };

export function Avatar({
  member,
  size = 'md',
}: {
  member: AvatarMember;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}) {
  if (member.photoUrl) {
    return (
      <div
        className={`avatar ${size}`}
        style={{ backgroundImage: `url(${member.photoUrl})` }}
        aria-label={member.name}
        role="img"
      />
    );
  }
  return (
    <div className={`avatar ${size}`} style={{ background: colorFor(member.id) }}>
      {initial(member.name)}
    </div>
  );
}
