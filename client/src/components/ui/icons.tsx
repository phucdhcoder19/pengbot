/**
 * Bộ icon dùng chung — nét 1.5px, cùng khung 24, không tô màu riêng
 * (luôn thừa hưởng currentColor). Không dùng emoji thay icon.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" />
  </Icon>
);

export const DocumentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9Z" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8M17 15l3-3-3-3M20 12H10" />
  </Icon>
);

export const UploadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16V4m-4 4 4-4 4 4M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m14 6-6 6 6 6" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5ZM12 10v4" />
    <path d="M12 17.2h.01" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 12 20 4.5 15 20l-3.5-6.5L4.5 12Z" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5M10 20v-5h4v5" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
  </Icon>
);

export const ThumbUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 21V10l4-7a2.2 2.2 0 0 1 2.2 2.7L12.5 9H18a1.8 1.8 0 0 1 1.8 2.2l-1.3 6.4A2 2 0 0 1 16.5 21Z" />
    <path d="M7 10H4v11h3" />
  </Icon>
);

/// Cùng hình với ThumbUpIcon, xoay 180° — hai icon luôn khớp nhau về nét
/// và khối lượng, không bao giờ lệch khi ai đó chỉnh một cái.
export const ThumbDownIcon = (p: IconProps) => (
  <ThumbUpIcon {...p} style={{ transform: "rotate(180deg)", ...p.style }} />
);
