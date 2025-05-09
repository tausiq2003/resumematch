export function ShowATSScore({ progress }: { progress: number }) {
    const radius = 4;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    return (
        <div className="flex-col justify-center mb-6">
            <div id="circle">
                <svg viewBox="0 0 10 10" width="30%">
                    {/* Background circle */}
                    <circle
                        cx="5"
                        cy="5"
                        r="4"
                        strokeWidth="1"
                        stroke="#cccccc"
                        fill="#fff"
                    />
                    {/* Progress circle */}
                    <circle
                        cx="5"
                        cy="5"
                        r="4"
                        strokeWidth="1"
                        stroke="#4caf50" // Change color as needed
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 5 5)" // Rotate to start from the top
                    />
                    {/* Text to display progress */}
                    <text
                        x="5"
                        y="5"
                        textAnchor="middle"
                        dy=".3em"
                        fontSize="2"
                        fill="#000"
                    >
                        {progress}
                    </text>
                </svg>
            </div>
        </div>
    );
}
