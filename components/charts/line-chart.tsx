'use client'

import { LineChart as RechartsLineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'

export interface NovoLinePoint {
  date: string
  cognitiveLoad: number
  confidence: number
}

export function NovoLineChart({ data }: { data: NovoLinePoint[] }) {
  return (
    <div className="h-[156px] w-full" role="img" aria-label="Tendencia de carga cognitiva y confianza del Gemelo">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid, rgba(183,243,208,.12))" strokeDasharray="2 5" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-label, rgba(183,243,208,.48))', fontSize: 9 }} tickMargin={8} minTickGap={24} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--chart-label, rgba(183,243,208,.48))', fontSize: 9 }} tickCount={3} />
          <Tooltip cursor={{ stroke: 'var(--chart-crosshair, rgba(183,243,208,.55))', strokeDasharray: '3 3' }} contentStyle={{ borderRadius: 14, border: '1px solid rgba(183,243,208,.18)', background: 'rgba(4,14,9,.92)', color: '#f5f1e8', fontSize: 11 }} />
          <Line type="monotone" dataKey="cognitiveLoad" name="Carga" stroke="#fbbf24" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: '#fbbf24' }} isAnimationActive animationDuration={700} />
          <Line type="monotone" dataKey="confidence" name="Confianza" stroke="#b7f3d0" strokeWidth={2.4} dot={false} activeDot={{ r: 3, strokeWidth: 0, fill: '#b7f3d0' }} isAnimationActive animationDuration={700} />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}
