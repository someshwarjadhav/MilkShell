import type * as React from "react";
import type { MilkType } from "../types";

interface P {
  size?: number;
  className?: string;
}

export const Drop: React.FC<P> = ({ size = 24, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
    >
      <path
        d="M16 3c5 6.5 9 11 9 16.2a9 9 0 0 1-18 0C7 14 11 9.5 16 3z"
        fill="currentColor"
      />
      <path
        d="M10 20c3-2 6 2 9 0s4 1 5.5 0"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const Logo: React.FC<{ size?: number }> = ({ size = 40 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="19" fill="#0E2A3A" />
      <path
        d="M32 11c8.5 10.5 15 17.5 15 26a15 15 0 0 1-30 0c0-8.5 6.5-15.5 15-26z"
        fill="#EAF6F7"
      />
      <path
        d="M17 38c5.5-3.5 10 3.5 15 0s9.5 3.5 15 0v.5a15 15 0 0 1-30 0z"
        fill="#14969B"
      />
      <circle cx="44" cy="17" r="3.5" fill="#F7DFA0" />
    </svg>
  );
};

export const MilkCan: React.FC<P> = ({ size = 48, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
    >
      <rect x="20" y="8" width="24" height="8" rx="4" fill="#9FB6C2" />
      <path
        d="M18 18h28l4 8v26a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V26z"
        fill="#C9D9E1"
      />
      <path d="M14 26h36" stroke="#9FB6C2" strokeWidth="3" />
      <rect x="22" y="32" width="20" height="14" rx="4" fill="#14969B" />
      <path
        d="M26 39h12M26 43h8"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const Tanker: React.FC<P> = ({ size = 64, className }) => {
  return (
    <svg
      width={size}
      height={size * 0.55}
      viewBox="0 0 120 66"
      className={className}
      aria-hidden
    >
      <rect
        x="4"
        y="12"
        width="74"
        height="34"
        rx="17"
        fill="#EAF3F5"
        stroke="#9FB6C2"
        strokeWidth="2"
      />
      <path
        d="M12 32c8-5 14 5 22 0s14 5 22 0 12 4 18 0"
        stroke="#14969B"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M80 22h20l10 14v14H80z" fill="#0E2A3A" />
      <path d="M86 27h12l6 9H86z" fill="#9ED6DA" />
      <rect x="4" y="46" width="108" height="6" rx="3" fill="#6C8796" />
      <circle cx="26" cy="54" r="8" fill="#0E2A3A" />
      <circle cx="26" cy="54" r="3" fill="#C9D9E1" />
      <circle cx="60" cy="54" r="8" fill="#0E2A3A" />
      <circle cx="60" cy="54" r="3" fill="#C9D9E1" />
      <circle cx="98" cy="54" r="8" fill="#0E2A3A" />
      <circle cx="98" cy="54" r="3" fill="#C9D9E1" />
    </svg>
  );
};

const SPOT: Record<MilkType, string> = {
  cow: "#F6EBD3",
  buffalo: "#3B4468",
  mix: "#F6EBD3",
};
const BODY: Record<MilkType, string> = {
  cow: "#E8A33D",
  buffalo: "#5668B8",
  mix: "#3EA076",
};

export const AnimalHead: React.FC<{
  type: MilkType;
  size?: number;
  className?: string;
}> = ({ type, size = 32, className }) => {
  const face = SPOT[type];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <circle cx="24" cy="24" r="24" fill={BODY[type]} opacity=".18" />
      {type === "cow" && (
        <g>
          <path
            d="M9 14c-4-1-5 3-3 5l5 2zM39 14c4-1 5 3 3 5l-5 2z"
            fill="#C98427"
          />
          <path
            d="M14 10l-2-5M34 10l2-5"
            stroke="#F6EBD3"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="24" cy="26" rx="12" ry="14" fill={face} />
          <path d="M14 18c4-5 12-5 16 0-2 4-14 4-16 0z" fill="#C98427" />
          <ellipse cx="24" cy="34" rx="7" ry="5" fill="#F0B8A4" />
          <circle cx="21.5" cy="34" r="1" fill="#7A4A3B" />
          <circle cx="26.5" cy="34" r="1" fill="#7A4A3B" />
          <circle cx="19" cy="25" r="1.7" fill="#0E2A3A" />
          <circle cx="29" cy="25" r="1.7" fill="#0E2A3A" />
        </g>
      )}
      {type === "buffalo" && (
        <g>
          <path
            d="M12 20C2 20 2 8 8 6c-1 6 4 8 8 8zM36 20c10 0 10-12 4-14 1 6-4 8-8 8z"
            fill="#2B3354"
          />
          <ellipse cx="24" cy="26" rx="12" ry="14" fill={face} />
          <ellipse cx="24" cy="34" rx="8" ry="6" fill="#59608A" />
          <circle cx="21" cy="34" r="1.2" fill="#1B2140" />
          <circle cx="27" cy="34" r="1.2" fill="#1B2140" />
          <circle cx="19" cy="24" r="1.7" fill="#fff" />
          <circle cx="29" cy="24" r="1.7" fill="#fff" />
        </g>
      )}
      {type === "mix" && (
        <g>
          <path d="M9 14c-4-1-5 3-3 5l5 2z" fill="#C98427" />
          <path
            d="M14 10l-2-5"
            stroke="#F6EBD3"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M36 20c10 0 10-12 4-14 1 6-4 8-8 8z" fill="#2B3354" />
          <path d="M24 12A12 14 0 0 0 24 40Z" fill="#F6EBD3" />
          <path d="M24 12A12 14 0 0 1 24 40Z" fill="#3B4468" />
          <path d="M14.5 18c3-4 6-5 9.5-5v6c-4 2-8 1-9.5-1z" fill="#C98427" />
          <path d="M24 28.5A7.5 5.5 0 0 0 24 39.5Z" fill="#F0B8A4" />
          <path d="M24 28.5A7.5 5.5 0 0 1 24 39.5Z" fill="#59608A" />
          <circle cx="21.5" cy="34" r="1" fill="#7A4A3B" />
          <circle cx="26.5" cy="34" r="1.1" fill="#1B2140" />
          <circle cx="19" cy="25" r="1.7" fill="#0E2A3A" />
          <circle cx="29" cy="25" r="1.7" fill="#fff" />
        </g>
      )}
    </svg>
  );
};
