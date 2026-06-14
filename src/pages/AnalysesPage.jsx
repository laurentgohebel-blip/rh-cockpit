import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line, PieChart, Pie,
} from "recharts";
import { useData } from "@/context/DataContext";

const PALETTE = ["#3b82f6", "#8b5cf6", "#0a8a5b", "#d97706", "#dc2626", "#0891b2", "#65a30d", "#ea580c"];

const tooltipStyle = {
  background: "white", border: "1px solid hsl(220 13% 91%)", borderRadius: 8, fontSize: 12,
  padding: "6px 10px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export default function AnalysesPage() {
  const { metrics: d } = useData();
  if (!d) return null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Analyses détaillées</h1>
        <p className="text-sm text-muted-foreground">Graphiques complémentaires sur l'effectif, les mouvements et la pyramide des âges.</p>
      </header>

      <Tabs defaultValue="effectifs">
        <TabsList>
          <TabsTrigger value="effectifs">Effectifs</TabsTrigger>
          <TabsTrigger value="mouvements">Mouvements</TabsTrigger>
          <TabsTrigger value="sites">Par site</TabsTrigger>
          <TabsTrigger value="retraite">Retraite</TabsTrigger>
        </TabsList>

        {/* Effectifs */}
        <TabsContent value="effectifs" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Pyramide des âges</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={d.ageBuckets} layout="vertical" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="tranche" tick={{ fontSize: 11 }} width={50} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="h" name="Hommes" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
                    <Bar dataKey="f" name="Femmes" fill="#db2777" radius={[0, 4, 4, 0]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ancienneté</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={d.ancBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                    <XAxis dataKey="tranche" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Salariés" fill={PALETTE[1]} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { title: "Genre", data: d.sexeData, colors: ["#db2777", PALETTE[0]] },
              { title: "Contrat", data: d.contratData, colors: [PALETTE[2], PALETTE[3]] },
              { title: "Temps", data: d.tempsData, colors: [PALETTE[1], PALETTE[5]] },
            ].map((cfg) => (
              <Card key={cfg.title}>
                <CardHeader><CardTitle>{cfg.title}</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={cfg.data} dataKey="value" outerRadius={70} innerRadius={45} paddingAngle={3} stroke="none">
                        {cfg.data.map((_, i) => <Cell key={i} fill={cfg.colors[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Mouvements */}
        <TabsContent value="mouvements" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Turnover annuel</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.turnoverAnnuel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="annee" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entrees" name="Entrées" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sorties" name="Sorties" fill={PALETTE[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Motifs de sortie</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(160, d.motifData.length * 28)}>
                <BarChart data={d.motifData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Sorties" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Par site */}
        <TabsContent value="sites">
          <Card>
            <CardHeader><CardTitle>Effectifs par établissement (H/F)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, d.etabs.length * 38)}>
                <BarChart data={d.etabs.map((e) => ({ name: e.label || `Étab ${e.name}`, Femmes: e.f, Hommes: e.h }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={170} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Femmes" stackId="a" fill="#db2777" />
                  <Bar dataKey="Hommes" stackId="a" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retraite */}
        <TabsContent value="retraite">
          <Card>
            <CardHeader><CardTitle>Salariés proches de la retraite</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={d.retraiteChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="age" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke={PALETTE[4]} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
