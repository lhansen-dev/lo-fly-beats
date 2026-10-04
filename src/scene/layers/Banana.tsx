export default function Banana() {
  return (
    <g className="banana">
      <ellipse cx="1350" cy="768" rx="166" ry="16" style={{ fill: 'var(--scene-shadow)', opacity: 'var(--scene-shadow-opacity)' }} />
      <path d="M 1194 691 C 1255 746 1384 782 1503 695 Q 1522 680 1513 665 C 1420 729 1290 721 1205 675 Q 1183 664 1184 682 Q 1185 688 1194 691 Z" style={{ fill: 'var(--scene-banana)' }} />
      <path d="M 1208 688 C 1290 726 1411 732 1508 674 C 1483 708 1432 730 1371 736 C 1304 741 1243 719 1208 688 Z" style={{ fill: 'var(--scene-banana-shade)' }} />
      <ellipse cx="1250" cy="708" rx="7" ry="4" transform="rotate(25 1250 708)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1290" cy="726" rx="6" ry="4" transform="rotate(18 1290 726)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1335" cy="737" rx="7" ry="4" transform="rotate(8 1335 737)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1380" cy="739" rx="6" ry="4" transform="rotate(-8 1380 739)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1425" cy="726" rx="7" ry="4" transform="rotate(-20 1425 726)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1465" cy="706" rx="6" ry="4" transform="rotate(-30 1465 706)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <ellipse cx="1358" cy="718" rx="5" ry="3" transform="rotate(-3 1358 718)" style={{ fill: 'var(--scene-banana-spot)' }} />
      <path d="M 1194 691 L 1184 682 L 1179 690 L 1191 702 Z" style={{ fill: 'var(--scene-banana-stem)' }} />
      <path d="M 1503 695 L 1513 665 Q 1521 660 1524 666 L 1515 700 Z" style={{ fill: 'var(--scene-banana-stem)' }} />
    </g>
  )
}
