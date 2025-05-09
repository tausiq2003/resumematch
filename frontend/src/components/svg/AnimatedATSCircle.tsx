import * as React from "react";
import { motion, useAnimation } from "framer-motion";

interface AnimatedATSCircleProps {
    score: number; // 0-100
}

const RADIUS = 54;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function AnimatedATSCircle({ score }: AnimatedATSCircleProps) {
    const controls = useAnimation();
    const [displayScore, setDisplayScore] = React.useState(0);
    const [currentColor, setCurrentColor] = React.useState("#ff5858"); // Start with red

    // Helper to interpolate color from red to yellow to green
    function getInterpolatedColor(val: number) {
        // val: 0-100
        if (val < 50) {
            // Red (#ff5858) to Yellow (#f7b42c)
            const percent = val / 50;
            const r = 255;
            const g = Math.round(88 + (180 - 88) * percent); // 88 to 180
            const b = Math.round(88 + (44 - 88) * percent); // 88 to 44
            return `rgb(${r},${g},${b})`;
        } else {
            // Yellow (#f7b42c) to Green (#43e97b)
            const percent = (val - 50) / 50;
            const r = Math.round(247 + (67 - 247) * percent); // 247 to 67
            const g = Math.round(180 + (233 - 180) * percent); // 180 to 233
            const b = Math.round(44 + (123 - 44) * percent); // 44 to 123
            return `rgb(${r},${g},${b})`;
        }
    }

    React.useEffect(() => {
        controls.start({
            strokeDashoffset: CIRCUMFERENCE * (1 - score / 100),
            transition: { duration: 1.2, ease: "easeInOut" },
        });
        const duration = 1200; // ms
        const startTime = performance.now();
        function animate(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const val = Math.ceil(score * progress);
            setDisplayScore(val);
            setCurrentColor(getInterpolatedColor(val));
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setDisplayScore(Math.ceil(score));
                setCurrentColor(getInterpolatedColor(score));
            }
        }
        requestAnimationFrame(animate);
        // eslint-disable-next-line
    }, [score]);

    return (
        <div className="flex flex-col items-center justify-center">
            <svg width={140} height={140} className="mb-2">
                <circle
                    cx={70}
                    cy={70}
                    r={RADIUS}
                    fill="none"
                    stroke="#22223b22"
                    strokeWidth={STROKE}
                />
                <motion.circle
                    cx={70}
                    cy={70}
                    r={RADIUS}
                    fill="none"
                    stroke={currentColor}
                    strokeWidth={STROKE}
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE}
                    strokeLinecap="round"
                    animate={controls}
                    initial={{ strokeDashoffset: CIRCUMFERENCE }}
                    style={{
                        transform: "rotate(-90deg)",
                        transformOrigin: "50% 50%",
                    }}
                />
                <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dy=".3em"
                    fontSize="2.2rem"
                    fontWeight="bold"
                    fill="#43e97b"
                >
                    {displayScore}
                </text>
            </svg>
        </div>
    );
}
