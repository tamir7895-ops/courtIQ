// coach-icons.jsx — Lucide-style stroke icons for the Coach tab

const coStroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const CoachIcon = {
  // header
  Back: (p) => <svg viewBox="0 0 14 14" {...p}><path d="M9 2L4 7l5 5" {...coStroke}/></svg>,
  // misc
  Up:    (p) => <svg viewBox="0 0 24 24" {...p}><path d="M7 14l5-5 5 5" {...coStroke}/></svg>,
  Down:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M7 10l5 5 5-5" {...coStroke}/></svg>,
  Flat:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M5 12h14" {...coStroke}/></svg>,
  Arrow: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M5 12h14M13 6l6 6-6 6" {...coStroke}/></svg>,
  Spark: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z" {...coStroke}/></svg>,
  Send:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...coStroke}/></svg>,
  Whistle:(p) => <svg viewBox="0 0 24 24" {...p}><circle cx="9" cy="13" r="6" {...coStroke}/><path d="M14 11l7-3v3l-7 1M9 13a2 2 0 1 0 0-4" {...coStroke}/></svg>,
  Clock: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...coStroke}/><path d="M12 7v5l3 2" {...coStroke}/></svg>,
  Bolt:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" {...coStroke}/></svg>,
  // skill icons
  Shoot: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...coStroke}/><path d="M12 3v18M3 12h18M5 5l14 14M5 19L19 5" {...coStroke}/></svg>,
  Handle:(p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="6" {...coStroke}/><path d="M12 6v12M6 12h12" {...coStroke}/></svg>,
  Defense:(p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" {...coStroke}/></svg>,
  Athl:  (p) => <svg viewBox="0 0 24 24" {...p}><path d="M5 17l4-4 3 3 7-8M14 8h4v4" {...coStroke}/></svg>,
};

window.CoachIcon = CoachIcon;
