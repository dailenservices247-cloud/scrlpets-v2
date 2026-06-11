"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { createCreature } from "@/lib/compose/actions";

type Creature = { id: string; name: string };

export function CreaturePicker({
  creatures,
  value,
  onChange,
}: {
  creatures: Creature[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("compose");
  const [list, setList] = useState(creatures);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");

  async function add() {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("species", species);
    const res = await createCreature(fd);
    if (res.ok && res.id) {
      setList([...list, { id: res.id, name }]);
      onChange(res.id);
      setAdding(false);
      setName("");
      setSpecies("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="creature-picker" className="text-sm text-muted-foreground">
        {t("creature")}
      </label>
      <select
        id="creature-picker"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded border border-input bg-transparent p-2"
        data-testid="creature-picker"
      >
        <option value="">{t("noCreature")}</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {!adding ? (
        <button
          type="button"
          className="text-sm text-brand-link text-left"
          onClick={() => setAdding(true)}
          data-testid="new-creature"
        >
          {t("newCreature")}
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            className="rounded border border-input bg-transparent p-2 flex-1 min-w-0"
            placeholder={t("creatureName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="creature-name"
          />
          <input
            className="rounded border border-input bg-transparent p-2 flex-1 min-w-0"
            placeholder={t("creatureSpecies")}
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          />
          <button
            type="button"
            onClick={add}
            className="rounded bg-secondary px-3 text-sm text-secondary-foreground"
            data-testid="creature-save"
          >
            {t("create")}
          </button>
        </div>
      )}
    </div>
  );
}
