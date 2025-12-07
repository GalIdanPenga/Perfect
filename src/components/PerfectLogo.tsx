interface PerfectLogoProps {
  size?: number;
}

export const PerfectLogo = ({ size = 32 }: PerfectLogoProps) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-sky-400">
    {/* Outer circle - thin ring */}
    <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>

    {/* Main perfect circle */}
    <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="2.5"/>

    {/* Checkmark - symbol of perfection */}
    <path
      d="M 11 16 L 14.5 19.5 L 21 13"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);
