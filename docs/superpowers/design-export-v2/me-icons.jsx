// me-icons.jsx — Lucide-style stroke icons for the Me tab

const meStroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const MeIcon = {
  // header
  Back: (p) => <svg viewBox="0 0 14 14" {...p}><path d="M9 2L4 7l5 5" {...meStroke}/></svg>,
  Customize: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 20h9M3 17l8-8 4 4-8 8H3v-4z" {...meStroke}/></svg>,
  // stats
  Sessions: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...meStroke}/><path d="M12 7v5l3 2" {...meStroke}/></svg>,
  Flame:    (p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-7-1.4 1-4 2-4 5 0 0-2-2-2-5C7 11 5 13 5 16a7 7 0 0 0 7 6z" {...meStroke}/></svg>,
  Bolt:     (p) => <svg viewBox="0 0 24 24" {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" {...meStroke}/></svg>,
  // trophies
  Target:    (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...meStroke}/><circle cx="12" cy="12" r="5" {...meStroke}/><circle cx="12" cy="12" r="1.5" {...meStroke}/></svg>,
  Hundred:   (p) => <svg viewBox="0 0 24 24" {...p}><path d="M5 8h2v8H5zM10 12c0-2 1-4 2-4s2 2 2 4-1 4-2 4-2-2-2-4zM17 12c0-2 1-4 2-4s2 2 2 4-1 4-2 4-2-2-2-4z" {...meStroke}/></svg>,
  Crosshair: (p) => <svg viewBox="0 0 24 24" {...p}><circle cx="12" cy="12" r="9" {...meStroke}/><path d="M12 3v4M12 17v4M3 12h4M17 12h4" {...meStroke}/></svg>,
  Shield:    (p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z" {...meStroke}/></svg>,
  Crown:     (p) => <svg viewBox="0 0 24 24" {...p}><path d="M3 18h18M3 6l4 5 5-7 5 7 4-5v12H3z" {...meStroke}/></svg>,
  Trophy:    (p) => <svg viewBox="0 0 24 24" {...p}><path d="M8 4h8v6a4 4 0 0 1-8 0V4zM4 4h4v3a3 3 0 0 1-3 3 1 1 0 0 1-1-1V4zM16 4h4v5a1 1 0 0 1-1 1 3 3 0 0 1-3-3V4zM10 14h4M10 20h4M9 20h6M12 14v6" {...meStroke}/></svg>,
  // social
  Send: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" {...meStroke}/></svg>,
  Link: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1" {...meStroke}/></svg>,
  Lock: (p) => <svg viewBox="0 0 24 24" {...p}><rect x="5" y="11" width="14" height="10" rx="2" {...meStroke}/><path d="M8 11V7a4 4 0 0 1 8 0v4" {...meStroke}/></svg>,
  Chev: (p) => <svg viewBox="0 0 14 14" {...p}><path d="M5 3l4 4-4 4" {...meStroke}/></svg>,
};

const MeTrophyIcon = ({ id, ...rest }) => {
  switch (id) {
    case "target":    return <MeIcon.Target {...rest}/>;
    case "flame":     return <MeIcon.Flame {...rest}/>;
    case "hundred":   return <MeIcon.Hundred {...rest}/>;
    case "crosshair": return <MeIcon.Crosshair {...rest}/>;
    case "shield":    return <MeIcon.Shield {...rest}/>;
    case "crown":     return <MeIcon.Crown {...rest}/>;
    case "bolt":      return <MeIcon.Bolt {...rest}/>;
    case "trophy":    return <MeIcon.Trophy {...rest}/>;
    default:          return <MeIcon.Target {...rest}/>;
  }
};

window.MeIcon = MeIcon;
window.MeTrophyIcon = MeTrophyIcon;
