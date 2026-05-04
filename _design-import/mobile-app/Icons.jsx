// Icons.jsx — Lucide-style inline stroke icons for CourtIQ
// Stroke 2, rounded, 24x24. currentColor-driven.
const Ic = ({ d, size = 22, ...p }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none"
stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
{d}
</svg>
);
const IcHome = (p) => <Ic {...p} d={<><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></>} />;
const IcTrain = (p) => <Ic {...p} d={<><path d="M6.5 6.5l11 11"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/></>} />;
const IcTrack = (p) => <Ic {...p} d={<><path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-5"/></>} />;
const IcCoach = (p) => <Ic {...p} d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>} />;
const IcMe = (p) => <Ic {...p} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></>} />;
const IcBell = (p) => <Ic {...p} d={<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>} />;
const IcPlay = (p) => <Ic {...p} d={<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>} />;
const IcCamera = (p) => <Ic {...p} d={<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>} />;
const IcUpload = (p) => <Ic {...p} d={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>} />;
const IcBolt = (p) => <Ic {...p} d={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>} />;
const IcFlame = (p) => <Ic {...p} d={<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>} />;
const IcShare = (p) => <Ic {...p} d={<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>} />;
const IcLock = (p) => <Ic {...p} d={<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>} />;
const IcTrophy = (p) => <Ic {...p} d={<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></>} />;
const IcChevR = (p) => <Ic {...p} d={<polyline points="9 18 15 12 9 6"/>} />;
const IcX = (p) => <Ic {...p} d={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>} />;
const IcMail = (p) => <Ic {...p} d={<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>} />;
const IcTarget = (p) => <Ic {...p} d={<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>} />;

Object.assign(window, {
Ic, IcHome, IcTrain, IcTrack, IcCoach, IcMe, IcBell, IcPlay, IcCamera,
IcUpload, IcBolt, IcFlame, IcShare, IcLock, IcTrophy, IcChevR, IcX, IcMail, IcTarget
});
