export default function Fly() {
  return (
    <g className="fly">
      <g className="fly-wings">
        <ellipse cx="1165" cy="480" rx="72" ry="26" transform="rotate(-35 1165 480)" style={{ fill: 'var(--scene-fly-wing)' }} />
        <ellipse cx="1180" cy="520" rx="64" ry="22" transform="rotate(-15 1180 520)" style={{ fill: 'var(--scene-fly-wing)' }} />
        <path d="M 1110 520 Q 1140 492 1180 458" fill="none" style={{ stroke: 'var(--scene-fly-wing-vein)' }} />
        <path d="M 1130 535 Q 1170 520 1210 495" fill="none" style={{ stroke: 'var(--scene-fly-wing-vein)' }} />
        <path d="M 1130 485 Q 1175 480 1215 470" fill="none" style={{ stroke: 'var(--scene-fly-wing-vein)' }} />
      </g>
      <g className="fly-body">
        <path d="M 1000 510 C 990 475 1020 455 1055 460 C 1090 465 1110 492 1105 525 Z" style={{ fill: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-part="torso" d="M 975 690 C 960 600 975 500 1040 480 C 1110 470 1140 560 1135 690 Z" style={{ fill: 'var(--scene-fly-hoodie)' }} />
        <line x1="1028" y1="500" x2="1022" y2="565" style={{ stroke: 'var(--scene-fly-drawstring)' }} />
        <line x1="1062" y1="500" x2="1068" y2="565" style={{ stroke: 'var(--scene-fly-drawstring)' }} />
        <circle cx="1022" cy="565" r="3" style={{ fill: 'var(--scene-fly-drawstring)' }} />
        <circle cx="1068" cy="565" r="3" style={{ fill: 'var(--scene-fly-drawstring)' }} />
        <path data-sleeve-outline="front-left" d="M 1000 560 Q 960 640 975 703" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="front-left" d="M 1000 560 Q 960 640 975 703" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-sleeve-outline="front-right" d="M 1080 560 Q 1050 650 998 697" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="front-right" d="M 1080 560 Q 1050 650 998 697" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-sleeve-outline="middle-left" d="M 985 600 Q 900 640 880 690" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="middle-left" d="M 985 600 Q 900 640 880 690" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-sleeve-outline="middle-right" d="M 1120 610 Q 1170 660 1160 700" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="middle-right" d="M 1120 610 Q 1170 660 1160 700" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-sleeve-outline="back-left" d="M 1010 610 Q 1050 640 1090 625" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="back-left" d="M 1010 610 Q 1050 640 1090 625" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <path data-sleeve-outline="back-right" d="M 1110 600 Q 1070 655 1030 650" fill="none" strokeWidth="30" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
        <path data-sleeve="back-right" d="M 1110 600 Q 1070 655 1030 650" fill="none" strokeWidth="24" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-hoodie-shade)' }} />
        <circle cx="880" cy="690" r="9" style={{ fill: 'var(--scene-fly-dark)' }} />
        <circle cx="1160" cy="700" r="9" style={{ fill: 'var(--scene-fly-dark)' }} />
        <circle cx="1090" cy="625" r="9" style={{ fill: 'var(--scene-fly-dark)' }} />
        <circle cx="1030" cy="650" r="9" style={{ fill: 'var(--scene-fly-dark)' }} />
      </g>
      <g className="fly-head">
        <g transform="rotate(-4 1045 462)">
          <path d="M 1005 325 Q 990 302 975 284" fill="none" strokeWidth="5" style={{ stroke: 'var(--scene-fly-dark)' }} />
          <path d="M 975 284 L 964 278 M 975 284 L 968 292 M 975 284 L 977 271" fill="none" strokeWidth="2" style={{ stroke: 'var(--scene-fly-dark)' }} />
          <path d="M 1060 322 Q 1070 300 1088 284" fill="none" strokeWidth="5" style={{ stroke: 'var(--scene-fly-dark)' }} />
          <path d="M 1088 284 L 1098 277 M 1088 284 L 1096 292 M 1088 284 L 1087 271" fill="none" strokeWidth="2" style={{ stroke: 'var(--scene-fly-dark)' }} />
          <circle cx="1040" cy="392" r="70" style={{ fill: 'var(--scene-fly-head)' }} />
          <ellipse cx="1000" cy="375" rx="34" ry="38" style={{ fill: 'var(--scene-fly-eye)' }} />
          <ellipse cx="1068" cy="370" rx="28" ry="34" style={{ fill: 'var(--scene-fly-eye)' }} />
          <circle cx="1012" cy="380" r="5" style={{ fill: 'var(--scene-fly-eye-facet)' }} />
          <circle cx="1060" cy="376" r="4" style={{ fill: 'var(--scene-fly-eye-facet)' }} />
          <path d="M 1030 440 Q 1024 456 1016 464" fill="none" strokeWidth="7" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-dark)' }} />
          <g className="fly-eye-shine">
            <path d="M 984 358 Q 992 345 1006 345" fill="none" strokeWidth="6" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-eye-shine)' }} />
            <path d="M 1056 354 Q 1062 343 1074 343" fill="none" strokeWidth="6" strokeLinecap="round" style={{ stroke: 'var(--scene-fly-eye-shine)' }} />
          </g>
          <g className="fly-headphones">
            <path d="M 966 396 C 960 300 1120 290 1112 366" fill="none" strokeWidth="16" style={{ stroke: 'var(--scene-fly-headphones)' }} />
            <ellipse cx="966" cy="420" rx="14" ry="26" style={{ fill: 'var(--scene-fly-headphones)' }} />
            <ellipse cx="1112" cy="400" rx="22" ry="36" style={{ fill: 'var(--scene-fly-headphones)' }} />
            <ellipse cx="966" cy="420" rx="7" ry="17" style={{ fill: 'var(--scene-fly-headphones-pad)' }} />
            <ellipse cx="1112" cy="400" rx="12" ry="25" style={{ fill: 'var(--scene-fly-headphones-pad)' }} />
            <path d="M 1124 430 C 1150 500 1120 580 1175 640 S 1215 690 1235 705" fill="none" strokeWidth="4" style={{ stroke: 'var(--scene-fly-cable)' }} />
          </g>
        </g>
      </g>
      <g className="fly-hands-front">
        <ellipse cx="975" cy="703" rx="12" ry="9" style={{ fill: 'var(--scene-fly-dark)' }} />
        <ellipse cx="998" cy="697" rx="12" ry="9" style={{ fill: 'var(--scene-fly-dark)' }} />
      </g>
    </g>
  )
}
