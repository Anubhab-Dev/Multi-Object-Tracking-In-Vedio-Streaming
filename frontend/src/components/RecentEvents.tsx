import React from "react";

interface EventLog {
  msg: string;
  color: "green" | "red" | "blue" | "orange";
  ts: string;
}

interface RecentEventsProps {
  events: EventLog[];
}

const dotColors: Record<string, string> = {
  green: "bg-[#22c55e] shadow-sm shadow-[#22c55e]/50",
  red: "bg-[#ef4444] shadow-sm shadow-[#ef4444]/50",
  blue: "bg-[#4f6ef7] shadow-sm shadow-[#4f6ef7]/50",
  orange: "bg-[#f97316] shadow-sm shadow-[#f97316]/50",
};

export default function RecentEvents({ events }: RecentEventsProps) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-2 min-h-[160px] max-h-[160px] flex flex-col gap-2">
      {events.length > 0 ? (
        events.map((ev, index) => (
          <div
            key={index}
            className="flex items-center justify-between border-b border-black/[0.03] dark:border-white/[0.03] pb-1.5 text-xs animate-[fadeIn_0.3s_ease]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[ev.color] || "bg-gray-400"}`}
              />
              <span className="truncate pr-2 font-medium">{ev.msg}</span>
            </div>
            <span className="font-mono text-[10px] text-[#6b7280] dark:text-[#4a5070] shrink-0 select-none">
              {ev.ts}
            </span>
          </div>
        ))
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#6b7280] dark:text-[#8b91b5] italic text-xs select-none">
          No recent events.
        </div>
      )}
    </div>
  );
}
