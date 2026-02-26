"use client";

import { motion } from "framer-motion";

interface Dice3DProps {
  result: number | null;
  isRolling: boolean;
}

const DOT_POSITIONS: Record<number, { top: string; left: string }[]> = {
  1: [{ top: "50%", left: "50%" }],
  2: [{ top: "25%", left: "25%" }, { top: "75%", left: "75%" }],
  3: [{ top: "20%", left: "20%" }, { top: "50%", left: "50%" }, { top: "80%", left: "80%" }],
  4: [
    { top: "25%", left: "25%" }, { top: "25%", left: "75%" },
    { top: "75%", left: "25%" }, { top: "75%", left: "75%" },
  ],
  5: [
    { top: "25%", left: "25%" }, { top: "25%", left: "75%" },
    { top: "50%", left: "50%" },
    { top: "75%", left: "25%" }, { top: "75%", left: "75%" },
  ],
  6: [
    { top: "20%", left: "25%" }, { top: "20%", left: "75%" },
    { top: "50%", left: "25%" }, { top: "50%", left: "75%" },
    { top: "80%", left: "25%" }, { top: "80%", left: "75%" },
  ],
};

function DieFace({ number, style }: { number: number; style?: React.CSSProperties }) {
  const dots = DOT_POSITIONS[number] || DOT_POSITIONS[1];
  return (
    <div
      className="dice-face"
      style={style}
    >
      <div className="relative w-full h-full">
        {dots.map((pos, i) => (
          <div
            key={i}
            className="dot absolute"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Dice3D({ result, isRolling }: Dice3DProps) {
  const faceRotations: Record<number, { rotateX: number; rotateY: number }> = {
    1: { rotateX: 0, rotateY: 0 },
    2: { rotateX: 0, rotateY: -90 },
    3: { rotateX: 90, rotateY: 0 },
    4: { rotateX: -90, rotateY: 0 },
    5: { rotateX: 0, rotateY: 90 },
    6: { rotateX: 0, rotateY: 180 },
  };

  const rotation = result ? faceRotations[result] : { rotateX: 0, rotateY: 0 };

  return (
    <div className="dice-scene mx-auto" aria-label={`Dice showing ${result ?? "nothing"}`}>
      <motion.div
        className="dice-cube"
        animate={
          isRolling
            ? {
                rotateX: [0, 360, 720, 1080],
                rotateY: [0, 270, 540, 810],
                transition: {
                  duration: 1.4,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  times: [0, 0.3, 0.6, 1],
                },
              }
            : {
                rotateX: rotation.rotateX,
                rotateY: rotation.rotateY,
                transition: { duration: 0.3, ease: "easeOut" },
              }
        }
        style={{ willChange: isRolling ? "transform" : "auto" }}
      >
        <DieFace number={1} style={{ transform: "rotateY(0deg) translateZ(40px)" }} />
        <DieFace number={6} style={{ transform: "rotateY(180deg) translateZ(40px)" }} />
        <DieFace number={2} style={{ transform: "rotateY(-90deg) translateZ(40px)" }} />
        <DieFace number={5} style={{ transform: "rotateY(90deg) translateZ(40px)" }} />
        <DieFace number={3} style={{ transform: "rotateX(90deg) translateZ(40px)" }} />
        <DieFace number={4} style={{ transform: "rotateX(-90deg) translateZ(40px)" }} />
      </motion.div>
    </div>
  );
}
