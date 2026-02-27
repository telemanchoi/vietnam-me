"use client";

import { FormPY02UrbanRural } from "./form-py02-urban-rural";
import { FormPY03LandUse } from "./form-py03-land-use";
import { FormPY04Projects } from "./form-py04-projects";
import { FormPY05Environment } from "./form-py05-environment";
import { FormPY06Resources } from "./form-py06-resources";
import { FormPY07ActionProgram } from "./form-py07-action-program";
import { FormPY08Goals } from "./form-py08-goals";

interface FormRendererProps {
  itemCode: string;
  value: string; // JSON string from EvaluationItem.content
  onChange?: (value: string) => void; // Callback with JSON string
  readOnly?: boolean;
}

export function FormRenderer({ itemCode, value, onChange, readOnly = false }: FormRendererProps) {
  // Parse JSON value, fallback to empty object
  const parsedValue = (() => { try { return JSON.parse(value || "{}"); } catch { return {}; } })();

  const handleChange = (data: any) => {
    onChange?.(JSON.stringify(data));
  };

  // Route to appropriate form component based on itemCode
  switch (itemCode) {
    case "PY-02": return <FormPY02UrbanRural value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-03": return <FormPY03LandUse value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-04": return <FormPY04Projects value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-05": return <FormPY05Environment value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-06": return <FormPY06Resources value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-07": return <FormPY07ActionProgram value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    case "PY-08": return <FormPY08Goals value={parsedValue} onChange={handleChange} readOnly={readOnly} />;
    default: return null; // PY-01 uses textarea, PY-09~11 use separate flow component
  }
}

// Helper to check if an itemCode has a structured form (PY-02~PY-08 individual forms)
export function hasStructuredForm(itemCode: string): boolean {
  return ["PY-02", "PY-03", "PY-04", "PY-05", "PY-06", "PY-07", "PY-08"].includes(itemCode);
}

// PY-09~PY-11 use a combined qualitative flow component (FormPY09to11Qualitative)
// They should be grouped together and rendered as a single flow, not individually.
export function isQualitativeFlowItem(itemCode: string): boolean {
  return ["PY-09", "PY-10", "PY-11"].includes(itemCode);
}
