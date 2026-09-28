import { BUILTIN_PRESETS } from "../../src/presets";
import { printJSON, printTable } from "../output";

export interface ListPresetsArgs {
  json?: boolean;
}

export async function listPresetsCommand(args: ListPresetsArgs): Promise<void> {
  const presetNames = Object.keys(BUILTIN_PRESETS);

  if (args.json) {
    const data = presetNames.map((name) => {
      const ruleSets = BUILTIN_PRESETS[name]!;
      const ruleCount = ruleSets.reduce(
        (sum, rules) => sum + Object.keys(rules).length,
        0,
      );

      const allRules = ruleSets.flatMap((rules) => Object.keys(rules));

      return { name, ruleCount, rules: allRules };
    });

    printJSON(data);
    return;
  }

  const rows = presetNames.map((name) => {
    const ruleSets = BUILTIN_PRESETS[name]!;
    const ruleCount = ruleSets.reduce(
      (sum, rules) => sum + Object.keys(rules).length,
      0,
    );

    return {
      name,
      rules: String(ruleCount),
    };
  });

  printTable(
    [
      { header: "Preset", width: 15, field: "name" },
      { header: "Rules", width: 7, field: "rules" },
    ],
    rows,
  );
}
