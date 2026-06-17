"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimelineChartProps {
  labels: number[];
  activeTracks: number[];
  accuracy: number[];
  theme: "light" | "dark";
}

export default function TimelineChart({
  labels,
  activeTracks,
  accuracy,
  theme,
}: TimelineChartProps) {
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any>({
    labels: [],
    datasets: [],
  });

  const isDark = theme === "dark";
  const textColor = isDark ? "#8b91b5" : "#6b7280";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)";

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const ctx = chart.ctx;
    const gradTracks = ctx.createLinearGradient(0, 0, 0, 200);
    gradTracks.addColorStop(0, isDark ? "rgba(79, 110, 247, 0.3)" : "rgba(79, 110, 247, 0.2)");
    gradTracks.addColorStop(1, "rgba(79, 110, 247, 0.0)");

    const gradAccuracy = ctx.createLinearGradient(0, 0, 0, 200);
    gradAccuracy.addColorStop(0, isDark ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.2)");
    gradAccuracy.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    setChartData({
      labels,
      datasets: [
        {
          label: "Active Tracks",
          data: activeTracks,
          borderColor: "#4f6ef7",
          backgroundColor: gradTracks,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: "#4f6ef7",
          pointBorderColor: "transparent",
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: "y",
        },
        {
          label: "Accuracy (%)",
          data: accuracy,
          borderColor: "#10b981",
          backgroundColor: gradAccuracy,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "transparent",
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: "y1",
        },
      ],
    });
  }, [labels, activeTracks, accuracy, isDark]);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        type: "linear",
        display: true,
        position: "left",
        beginAtZero: true,
        title: {
          display: true,
          text: "Tracks",
          color: textColor,
          font: { family: "Inter", size: 11, weight: "bold" },
        },
        grid: { color: gridColor },
        ticks: {
          color: textColor,
          font: { family: "Inter", size: 11 },
        },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        min: 50,
        max: 100,
        title: {
          display: true,
          text: "Accuracy %",
          color: "#10b981",
          font: { family: "Inter", size: 11, weight: "bold" },
        },
        grid: { drawOnChartArea: false },
        ticks: {
          color: "#10b981",
          font: { family: "Inter", size: 11 },
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: textColor,
          maxTicksLimit: 8,
          font: { family: "Inter", size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: textColor,
          boxWidth: 12,
          boxHeight: 12,
          font: { family: "Inter", size: 11 },
        },
      },
    },
  };

  return (
    <div className="w-full h-full min-h-[220px]">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}
