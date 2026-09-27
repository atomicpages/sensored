import { cleanEnv, str } from "envalid";

export const env = cleanEnv(process.env, {
  TYPESAFE_API_KEY: str(),
  OPENAI_API_KEY: str(),
  MODEL: str({ default: "gpt-4o-mini" }),
});
