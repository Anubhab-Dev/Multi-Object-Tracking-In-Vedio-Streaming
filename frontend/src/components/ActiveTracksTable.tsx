import React from "react";

interface Track {
  id: number;
  class: string;
  confidence: number;
  x: number;
  y: number;
  speed: number;
  direction?: string;
  speeding?: boolean;
}

interface ActiveTracksTableProps {
  tracks: Track[];
}

const classIcons: Record<string, string> = {
  pedestrian: "🚶",
  people: "👥",
  person: "🚶",
  bicycle: "🚲",
  car: "🚗",
  van: "🚐",
  truck: "🚛",
  tricycle: "🛺",
  "awning-tricycle": "🛺",
  bus: "🚌",
  motor: "🏍️",
  motorcycle: "🏍️",
  others: "📦",
};

export default function ActiveTracksTable({ tracks }: ActiveTracksTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-black/5 dark:border-white/5 uppercase text-[9px] font-bold text-[#6b7280] dark:text-[#8b91b5]">
            <th className="px-5 py-3">ID</th>
            <th className="px-5 py-3">Class</th>
            <th className="px-5 py-3">Conf.</th>
            <th className="px-5 py-3">Position</th>
            <th className="px-5 py-3">Speed</th>
            <th className="px-5 py-3">Dir.</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {tracks.length > 0 ? (
            tracks.map((t) => {
              const ts = new Date().toTimeString().split(" ")[0];
              return (
                <tr
                  key={t.id}
                  className={`hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors ${
                    t.speeding
                      ? "text-[#ef4444] bg-[#ef4444]/5 hover:bg-[#ef4444]/8"
                      : ""
                  }`}
                >
                  <td className="px-5 py-3 font-bold">{t.id}</td>
                  <td className="px-5 py-3 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>{classIcons[t.class] || "📦"}</span>
                      <span>{t.class}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-mono">
                    {t.confidence.toFixed(2)}
                  </td>
                  <td className="px-5 py-3 font-mono">
                    ({t.x}, {t.y})
                  </td>
                  <td className="px-5 py-3 font-bold font-mono">
                    {t.speed} km/h
                  </td>
                  <td className="px-5 py-3 font-bold text-base select-none">
                    {t.direction || "→"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        t.speeding
                          ? "bg-[#ef4444]/12 text-[#ef4444] border border-[#ef4444]/15"
                          : "bg-[#22c55e]/12 text-[#22c55e] border border-[#22c55e]/15"
                      }`}
                    >
                      {t.speeding ? "Speed Limit" : "Tracking"}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-[#6b7280] dark:text-[#4a5070]">
                    {ts}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={8}
                className="px-5 py-8 text-center text-[#6b7280] dark:text-[#8b91b5] italic font-medium"
              >
                No active tracks. Start the stream to begin tracking.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
