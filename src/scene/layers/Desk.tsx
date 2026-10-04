export default function Desk() {
  return (
    <g className="desk">
      <rect x="0" y="600" width="1600" height="300" style={{ fill: 'var(--scene-desk)' }} />
      <path d="M 0 650 Q 320 646 640 652 T 1280 650 T 1600 654" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.16' }} />
      <path d="M 0 730 Q 360 736 720 728 T 1440 734 T 1600 730" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.13' }} />
      <path d="M 0 810 Q 400 804 800 812 T 1600 808" fill="none" style={{ stroke: 'var(--scene-desk-edge)', opacity: '0.15' }} />
      <rect x="0" y="860" width="1600" height="40" style={{ fill: 'var(--scene-desk-edge)' }} />
      <g className="mug">
        <ellipse cx="535" cy="711" rx="55" ry="11" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
        <path d="M 575 630 C 620 625 621 680 575 679" fill="none" strokeWidth="13" style={{ stroke: 'var(--scene-mug)' }} />
        <path d="M 490 620 L 580 620 L 570 699 Q 535 718 500 699 Z" style={{ fill: 'var(--scene-mug)' }} />
        <ellipse cx="535" cy="620" rx="45" ry="10" style={{ fill: 'var(--scene-mug)' }} />
        <ellipse cx="535" cy="620" rx="36" ry="5" style={{ fill: 'var(--scene-desk-edge)' }} />
      </g>
      <g className="homework">
        <ellipse cx="875" cy="778" rx="170" ry="15" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
        <g transform="rotate(-5 850 710)">
          <rect x="710" y="646" width="310" height="132" style={{ fill: 'var(--scene-paper)' }} />
        </g>
        <rect x="730" y="650" width="310" height="132" style={{ fill: 'var(--scene-paper)' }} />
        <text x="755" y="690" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="28" style={{ fill: 'var(--scene-ink)' }}>HW</text>
        <path d="M 755 710 Q 780 700 800 711 T 845 710" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 722 Q 780 712 800 723 T 845 722" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 734 Q 780 724 800 735 T 845 734" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 746 Q 780 736 800 747 T 845 746" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <path d="M 755 758 Q 780 748 800 759 T 845 758" fill="none" style={{ stroke: 'var(--scene-ink)' }} />
        <g className="pencil">
          <path d="M 805 753 L 1000 700 L 1007 710 L 812 763 Z" style={{ fill: 'var(--scene-pencil)' }} />
          <path d="M 1000 700 L 1018 695 L 1007 710 Z" style={{ fill: 'var(--scene-pencil-tip)' }} />
        </g>
      </g>
    </g>
  )
}
