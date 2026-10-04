import { cleanEnv, str } from "envalid";

export const env = cleanEnv(process.env, {
  TYPESAFE_API_KEY: str(),
  OPENAI_API_KEY: str(),
  ANTHROPIC_API_KEY: str(),
  OPENAI_MODEL: str({ default: "gpt-4o-mini" }),
  ANTHROPIC_MODEL: str({ default: "claude-haiku-4-5-20251001" }),
});
