// Inline stroke icons: no emoji, no font dependency, inherits currentColor.
const P = {
  cursor: <path d="M5 3l6.5 16 2.3-6.2 6.2-2.3z" />,
  brush: <><path d="M4 20c2.2 0 3.2-1.1 3.2-3 0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3C11.8 19.6 9.6 21 6.6 21H4z" /><path d="M13.6 14.4 21 7a2.4 2.4 0 0 0-3.4-3.4l-7.4 7.4" /></>,
  eraser: <><path d="M9 21h11" /><path d="M3.9 15.1 9 20.2l9.5-9.5a2.3 2.3 0 0 0 0-3.2l-2-2a2.3 2.3 0 0 0-3.2 0L3.9 15.1z" /></>,
  square: <rect x="3.5" y="3.5" width="17" height="17" rx="2" />,
  squareDash: <rect x="3.5" y="3.5" width="17" height="17" rx="2" strokeDasharray="3.5 3" />,
  bucket: <><path d="M5.5 10.5 11 5l8 8-5.5 5.5a2.6 2.6 0 0 1-3.7 0l-4.3-4.3a2.6 2.6 0 0 1 0-3.7z" /><path d="M9 4.5 11 6.5" /><path d="M19.5 15.5c.6 1 1.5 2 1.5 3a1.8 1.8 0 1 1-3.6 0c0-1 .9-2 1.5-3l.3-.4z" /></>,
  text: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  dropper: <><path d="M18.5 3.5a2.7 2.7 0 0 0-3.8 0L12 6.2l-1-1-2 2 7.8 7.8 2-2-1-1 2.7-2.7a2.7 2.7 0 0 0 0-3.8z" /><path d="M11.5 9.5 4 17v3h3l7.5-7.5" /></>,
  image: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m20 15-4.5-4.5L5 21" /></>,
  layers: <><path d="m12 2.5 9.5 5-9.5 5-9.5-5z" /><path d="m3 12.5 9 4.7 9-4.7M3 17l9 4.7 9-4.7" /></>,
  cube: <><path d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7z" /><path d="M3.5 7 12 11.6 20.5 7M12 11.6v9.9" /></>,
  download: <path d="M12 3.5v11.5M7.5 10.5 12 15l4.5-4.5M4 20.5h16" />,
  undo: <><path d="M3.5 7.5v5h5" /><path d="M4.2 12.5a8 8 0 1 0 2.1-5.3L3.5 9.8" /></>,
  copy: <><rect x="9" y="9" width="11.5" height="11.5" rx="2" /><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 4h8a1.5 1.5 0 0 1 1.5 1.5V6" /></>,
  trash: <path d="M3.5 6h17M9 6V4.5A1 1 0 0 1 10 3.5h4a1 1 0 0 1 1 1V6M18.5 6l-.9 13.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.5 6" />,
  up: <path d="M12 19.5V5M5.5 11.5 12 5l6.5 6.5" />,
  down: <path d="M12 4.5V19M18.5 12.5 12 19l-6.5-6.5" />,
  eye: <><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.4 5.7A11.7 11.7 0 0 1 12 5.5c6.2 0 10 6.5 10 6.5a18 18 0 0 1-3.3 4.1M6.5 6.9A17.6 17.6 0 0 0 2 12s3.8 6.5 10 6.5a11.4 11.4 0 0 0 3.6-.6" /></>,
  lock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  unlock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.6-1.8" /></>,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  close: <path d="M18.5 5.5 5.5 18.5M5.5 5.5l13 13" />,
  sliders: <path d="M4 21v-6.5M4 10.5V3M12 21v-8.5M12 8.5V3M20 21v-4.5M20 12.5V3M1.5 14.5h5M9.5 8.5h5M17.5 16.5h5" />,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  spin: <><path d="M21 12a9 9 0 1 1-2.6-6.3" /><path d="M21 3.5v6h-6" /></>,
  reset: <><path d="M3 12a9 9 0 1 0 2.6-6.3" /><path d="M3 3.5v6h6" /></>,
  alignLeft: <path d="M3.5 6h17M3.5 12h11M3.5 18h15" />,
  alignCenter: <path d="M3.5 6h17M6.5 12h11M4.5 18h15" />,
  alignRight: <path d="M3.5 6h17M9.5 12h11M5.5 18h15" />,
  pixel: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /><path d="M13.5 3.5h7v7M10.5 20.5h-7v-7" strokeDasharray="2.5 2.5" /></>,
};

export default function Icon({ name, size = 16 }) {
  const body = P[name];
  if (!body) return null;
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}
