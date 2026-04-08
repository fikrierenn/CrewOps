import React, { useMemo } from "react";
import type { Task } from "../api";

interface Props {
  tasks: Task[];
  onTaskClick?: (taskId: number) => void;
}

interface NodeLayout {
  task: Task;
  level: number;
  col: number;
  x: number;
  y: number;
}

const NODE_W = 180;
const NODE_H = 48;
const GAP_X = 40;
const GAP_Y = 60;
const PAD = 20;

const STATUS_FILL: Record<string, string> = {
  pending: "#334155",
  running: "#312e81",
  completed: "#064e3b",
  failed: "#7f1d1d",
  blocked: "#78350f",
};

const STATUS_STROKE: Record<string, string> = {
  pending: "#475569",
  running: "#6366f1",
  completed: "#10b981",
  failed: "#ef4444",
  blocked: "#f59e0b",
};

export function TaskDagGraph({ tasks, onTaskClick }: Props) {
  const { nodes, edges, width, height } = useMemo(() => {
    if (tasks.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

    // Level hesapla (BFS: dependency'si olmayan = level 0)
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const levels = new Map<number, number>();

    function getLevel(id: number): number {
      if (levels.has(id)) return levels.get(id)!;
      const task = taskMap.get(id);
      if (!task || task.dependencyIds.length === 0) {
        levels.set(id, 0);
        return 0;
      }
      const maxDepLevel = Math.max(
        ...task.dependencyIds
          .filter((d) => taskMap.has(d))
          .map((d) => getLevel(d))
      );
      const level = (maxDepLevel === -Infinity ? 0 : maxDepLevel) + 1;
      levels.set(id, level);
      return level;
    }

    for (const t of tasks) getLevel(t.id);

    // Level'lara gore gruplama
    const levelGroups = new Map<number, Task[]>();
    for (const t of tasks) {
      const lv = levels.get(t.id) ?? 0;
      if (!levelGroups.has(lv)) levelGroups.set(lv, []);
      levelGroups.get(lv)!.push(t);
    }

    const maxLevel = Math.max(...levelGroups.keys(), 0);
    const maxCols = Math.max(...[...levelGroups.values()].map((g) => g.length), 1);

    // Node pozisyonlarini hesapla
    const nodeLayouts: NodeLayout[] = [];
    for (let lv = 0; lv <= maxLevel; lv++) {
      const group = levelGroups.get(lv) || [];
      const totalWidth = group.length * NODE_W + (group.length - 1) * GAP_X;
      const startX = PAD + (maxCols * NODE_W + (maxCols - 1) * GAP_X - totalWidth) / 2;

      group.forEach((task, col) => {
        nodeLayouts.push({
          task,
          level: lv,
          col,
          x: startX + col * (NODE_W + GAP_X),
          y: PAD + lv * (NODE_H + GAP_Y),
        });
      });
    }

    const nodeMap = new Map(nodeLayouts.map((n) => [n.task.id, n]));

    // Edge'ler (dependency oklar)
    const edgeList: { from: NodeLayout; to: NodeLayout }[] = [];
    for (const n of nodeLayouts) {
      for (const depId of n.task.dependencyIds) {
        const dep = nodeMap.get(depId);
        if (dep) {
          edgeList.push({ from: dep, to: n });
        }
      }
    }

    const svgWidth = maxCols * NODE_W + (maxCols - 1) * GAP_X + PAD * 2;
    const svgHeight = (maxLevel + 1) * (NODE_H + GAP_Y) - GAP_Y + PAD * 2;

    return { nodes: nodeLayouts, edges: edgeList, width: svgWidth, height: svgHeight };
  }, [tasks]);

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-500">Henuz gorev yok.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-700/60 bg-slate-900/50 p-2">
      <svg width={width} height={height} className="mx-auto">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const x1 = e.from.x + NODE_W / 2;
          const y1 = e.from.y + NODE_H;
          const x2 = e.to.x + NODE_W / 2;
          const y2 = e.to.y;
          const midY = (y1 + y2) / 2;

          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const fill = STATUS_FILL[n.task.status] || STATUS_FILL.pending;
          const stroke = STATUS_STROKE[n.task.status] || STATUS_STROKE.pending;
          const isRunning = n.task.status === "running";
          const isCompleted = n.task.status === "completed";
          const truncTitle =
            n.task.title.length > 20 ? n.task.title.slice(0, 18) + "..." : n.task.title;

          return (
            <g
              key={n.task.id}
              onClick={() => onTaskClick?.(n.task.id)}
              style={{ cursor: onTaskClick ? "pointer" : "default" }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
              >
                {isRunning && (
                  <animate
                    attributeName="stroke-opacity"
                    values="1;0.3;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                )}
              </rect>

              {/* Task ID */}
              <text
                x={n.x + 8}
                y={n.y + 16}
                fontSize={10}
                fill="#94a3b8"
                fontFamily="monospace"
              >
                #{n.task.id}
              </text>

              {/* Role badge */}
              <text
                x={n.x + NODE_W - 8}
                y={n.y + 16}
                fontSize={9}
                fill="#a78bfa"
                fontFamily="monospace"
                textAnchor="end"
              >
                {n.task.roleId.length > 12 ? n.task.roleId.slice(0, 10) + ".." : n.task.roleId}
              </text>

              {/* Title */}
              <text
                x={n.x + 8}
                y={n.y + 34}
                fontSize={11}
                fill="#e2e8f0"
                fontFamily="sans-serif"
              >
                {truncTitle}
              </text>

              {/* Completed checkmark */}
              {isCompleted && (
                <text
                  x={n.x + NODE_W - 10}
                  y={n.y + 36}
                  fontSize={14}
                  fill="#10b981"
                  textAnchor="end"
                >
                  ✓
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
