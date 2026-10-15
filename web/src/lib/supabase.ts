import { browserDb } from "./supabase-browser";

type DatabaseClient = ReturnType<typeof browserDb>;

export const supabase = new Proxy({} as DatabaseClient, {
  get(_target, property) {
    const client = browserDb();
    const value = Reflect.get(client, property);

    return typeof value === "function"
      ? value.bind(client)
      : value;
  },
});