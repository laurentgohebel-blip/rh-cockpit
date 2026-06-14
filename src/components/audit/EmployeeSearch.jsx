import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function EmployeeSearch({ employees, onSelect }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = q.length < 2
    ? []
    : employees
        .filter((e) =>
          `${e.nom || ""} ${e.prenom || ""}`.toLowerCase().includes(q.toLowerCase()) ||
          (e.ville || "").toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 8);

  return (
    <div ref={ref} className="relative w-64">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher un salarié…"
        className="pl-8"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.map((e) => (
            <li
              key={e.id}
              onClick={() => { onSelect?.(e); setQ(""); setOpen(false); }}
              className="flex cursor-pointer items-center justify-between border-b px-3 py-2 text-sm last:border-b-0 hover:bg-secondary"
            >
              <div>
                <p className="font-medium">{e.nom} {e.prenom}</p>
                <p className="text-xs text-muted-foreground">{e.ville} · Étab. {e.etab}</p>
              </div>
              <span className={`text-xs font-medium ${e.actif ? "text-success" : "text-destructive"}`}>
                {e.actif ? "Actif" : "Sorti"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
