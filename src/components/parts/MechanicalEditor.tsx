"use client";

// MECHANICAL data editor (design §3.3). The shared entries list (label/value/
// unit + element anchors) plus the four optional mechanical scalars — home for
// the WROOM antenna keep-out and the USB-C shield/mounting facts (§7).
// Controlled `{ data, onChange }`; the parent validates against
// `mechanicalSchema` before dispatch.

import type { Mechanical } from "@/lib/schemas/part-fact";
import { EntryRowsEditor, type EntryDraft } from "@/components/parts/EntryRowsEditor";
import {
  inputClass as fieldInputClass,
  labelClass,
} from "@/components/guide/field-styles";

const inputClass = `mt-1 w-full ${fieldInputClass}`;

export function MechanicalEditor({
  data,
  onChange,
}: {
  data: Mechanical;
  onChange: (next: Mechanical) => void;
}) {
  function patch(p: Partial<Mechanical>) {
    onChange({ ...data, ...p });
  }

  return (
    <div className="space-y-4">
      <EntryRowsEditor
        entries={data.entries as EntryDraft[]}
        onChange={(entries) => patch({ entries })}
        addLabel="Add mechanical entry"
        emptyHint="No mechanical entries yet — add one below."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Footprint ref (optional)</label>
          <input
            value={data.footprintRef ?? ""}
            onChange={(e) =>
              patch({ footprintRef: e.target.value || undefined })
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Mounting type (optional)</label>
          <input
            value={data.mountingType ?? ""}
            onChange={(e) =>
              patch({ mountingType: e.target.value || undefined })
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Shield bonding (optional)</label>
          <input
            value={data.shieldBonding ?? ""}
            onChange={(e) =>
              patch({ shieldBonding: e.target.value || undefined })
            }
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Keep-out (optional)</label>
          <input
            value={data.keepOut ?? ""}
            onChange={(e) => patch({ keepOut: e.target.value || undefined })}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
