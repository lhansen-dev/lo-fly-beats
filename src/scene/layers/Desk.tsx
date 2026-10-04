export default function Desk() {
  return (
    <g className="desk">
      <defs><linearGradient id="desk-depth" x1="0" x2="0" y1="0" y2="1"><stop style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0.09" /><stop offset="1" style={{ stopColor: 'var(--scene-shadow)' }} stopOpacity="0.35" /></linearGradient><linearGradient id="mug-round" x1="0" x2="1"><stop style={{ stopColor: 'var(--scene-shadow)' }} stopOpacity="0.28" /><stop offset="0.5" style={{ stopColor: 'var(--scene-warm)' }} stopOpacity="0.2" /><stop offset="1" style={{ stopColor: 'var(--scene-shadow)' }} stopOpacity="0.15" /></linearGradient></defs>
      <rect x="0" y="600" width="1600" height="300" style={{ fill: 'var(--scene-desk)' }} />
      <rect x="0" y="600" width="1600" height="300" fill="url(#desk-depth)" />
      <path d="M 0 603 H 1600" style={{ stroke: 'var(--scene-paper)' }} opacity="0.12" strokeWidth="3" />
      <path d="M 0 650 Q 320 646 640 652 T 1280 650 T 1600 654" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.16' }} />
      <path d="M 0 730 Q 360 736 720 728 T 1440 734 T 1600 730" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.13' }} />
      <path d="M 0 810 Q 400 804 800 812 T 1600 808" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.15' }} />
      <rect x="0" y="860" width="1600" height="40" style={{ fill: 'var(--scene-desk-edge)' }} />
      <g className="mug">
        <ellipse cx="535" cy="711" rx="55" ry="11" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
        <path d="M 575 630 C 620 625 621 680 575 679" fill="none" strokeWidth="13" style={{ stroke: 'var(--scene-mug)' }} />
        <path d="M 490 620 L 580 620 L 570 699 Q 535 718 500 699 Z" style={{ fill: 'var(--scene-mug)' }} />
        <path d="M 490 620 L 580 620 L 570 699 Q 535 718 500 699 Z" fill="url(#mug-round)" />
        <path d="M 509 638 L 513 684" style={{ stroke: 'var(--scene-paper)' }} strokeWidth="3" strokeLinecap="round" opacity="0.18" />
        <g className="coffee-steam" fill="none" style={{ stroke: 'var(--scene-paper)' }} strokeWidth="3" strokeLinecap="round"><path d="M 518 593 Q 503 575 518 557 T 518 525" /><path d="M 541 587 Q 559 570 541 552 T 541 522" /><path d="M 556 600 Q 569 586 558 574" /></g>
        <ellipse cx="535" cy="620" rx="45" ry="10" style={{ fill: 'var(--scene-mug)' }} />
        <ellipse cx="535" cy="620" rx="36" ry="5" style={{ fill: 'var(--scene-desk-edge)' }} />
      </g>
      <g className="homework">
        <ellipse cx="875" cy="778" rx="170" ry="15" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
        <g transform="rotate(-5 850 710)">
          <rect x="710" y="646" width="310" height="132" style={{ fill: 'var(--scene-paper)' }} />
        </g>
        <rect x="730" y="650" width="310" height="132" style={{ fill: 'var(--scene-paper)' }} />
        <text x="755" y="690" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="17" style={{ fill: 'var(--scene-ink)' }}>HW</text>
        <path d="M 755 710 Q 780 700 800 711 T 845 710" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 722 Q 780 712 800 723 T 845 722" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 734 Q 780 724 800 735 T 845 734" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 746 Q 780 736 800 747 T 845 746" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 758 Q 780 748 800 759 T 845 758" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <g fill="none" style={{ stroke: 'var(--scene-ink)' }} opacity="0.3"><path d="M 863 673 H 1008 M 863 690 H 1008 M 863 707 H 1008 M 863 724 H 1008 M 863 741 H 1008 M 883 660 V 765 M 912 660 V 765 M 941 660 V 765 M 970 660 V 765 M 999 660 V 765" /><path d="M 867 735 Q 878 702 900 725 T 940 716 T 984 700" strokeWidth="2" /></g>
        <g className="pencil">
          <path d="M 805 753 L 1000 700 L 1007 710 L 812 763 Z" style={{ fill: 'var(--scene-pencil)' }} />
          <path d="M 1000 700 L 1018 695 L 1007 710 Z" style={{ fill: 'var(--scene-pencil-tip)' }} />
        </g>
      </g>
    </g>
  )
}
