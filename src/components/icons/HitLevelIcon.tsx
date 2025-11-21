import React from "react";

export const HitLevelIcon = React.memo(({ level }: { level: string }) => {
    let bgColor = "bg-gray-400";
    let textColor = "text-white";

    switch (level.toUpperCase()) {
        case "M":
            bgColor = "bg-yellow-500";
            break;
        case "L":
            bgColor = "bg-cyan-500";
            break;
        case "H":
            bgColor = "bg-pink-500";
            break;
        case "SM":
            bgColor = "bg-purple-500";
            break;
        case "SL":
            bgColor = "bg-cyan-500";
            break;
        case "SH":
            bgColor = "bg-orange-500";
            break;
    }

    return (
        <div
            className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center p-px ring-1 ring-black"
            title={level}
        >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-px">
                <div
                    className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold ${bgColor} ${textColor}`}
                >
                    {level.length > 1 &&
                    ["SL", "SH", "SM"].includes(level.toUpperCase())
                        ? level.toUpperCase()
                        : level.charAt(0).toUpperCase()}
                </div>
            </div>
        </div>
    );
});
